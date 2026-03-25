import { db } from "@/lib/db";
import { routerAgent, shouldEscalate } from "@/agents/RouterAgent";
import { leadQualificationAgent } from "@/agents/LeadQualificationAgent";
import { supportAgent } from "@/agents/SupportAgent";
import { bookingAgent } from "@/agents/BookingAgent";
import { followUpAgent } from "@/agents/FollowUpAgent";
import { getOllamaConfig } from "@/lib/ollamaConfig";
import type { AiMessage } from "@/lib/ai";
import type { AgentType, AgentPersona, Channel, Conversation, Contact } from "@prisma/client";

// ─── Persona context builder ─────────────────────────────────────────────────
// Turns DB fields into concrete behavioral instructions the model follows.
export function buildPersonaContext(persona: AgentPersona | null): string {
  if (!persona) return "";

  const lines: string[] = [];

  // Name & role — shapes how the agent introduces itself
  lines.push(`You are ${persona.name}.`);

  const roleDescriptions: Record<string, string> = {
    RECEPTIONIST: "Your role is reception — greet warmly, qualify quickly, route wisely.",
    MARKETER:     "Your role is marketing — be persuasive, highlight value, create urgency.",
    SALES:        "Your role is sales — understand the customer's needs deeply, recommend confidently.",
    SUPPORT:      "Your role is support — be patient, thorough, and reassuring.",
    GENERAL:      "Your role is general assistance.",
  };
  if (persona.role && roleDescriptions[persona.role]) {
    lines.push(roleDescriptions[persona.role]);
  }

  // Tone — shapes word choice and sentence structure
  const toneInstructions: Record<string, string> = {
    FRIENDLY:     "Use a warm, conversational tone. Treat the customer like a valued friend.",
    PROFESSIONAL: "Use a polished, business-appropriate tone. Be clear and concise.",
    CASUAL:       "Use a relaxed, informal tone. Feel free to be playful and direct.",
    FORMAL:       "Use a respectful, formal tone. Be precise and courteous.",
  };
  if (persona.tone && toneInstructions[persona.tone]) {
    lines.push(toneInstructions[persona.tone]);
  }

  // Language — detect from custom instructions if possible, otherwise use DB field.
  // Priority: if custom instructions contain Arabic script → force Arabic.
  const hasArabic = /[\u0600-\u06FF]/.test(persona.instructions ?? "");
  const langInstructions: Record<string, string> = {
    en: "Respond in English.",
    ar: "Respond in Arabic (use Arabic script throughout).",
    hi: "Respond in Hindi.",
    fr: "Respond in French.",
  };
  const lang = hasArabic ? "ar" : persona.language;
  lines.push(langInstructions[lang] ?? langInstructions.en);

  // Emoji style — concrete rule the model actually follows
  const emojiRules: Record<string, string> = {
    NEVER:    "Do NOT use emojis.",
    SOMETIMES: "Use emojis sparingly — only for warmth on greetings or celebrations. Keep it minimal.",
    OFTEN:    "Use 1-2 relevant emojis per message to add personality.",
  };
  if (persona.emojiStyle && emojiRules[persona.emojiStyle]) {
    lines.push(emojiRules[persona.emojiStyle]);
  }

  // Custom instructions — highest priority override
  if (persona.instructions?.trim()) {
    lines.push(`\nCustom instructions from the business owner: ${persona.instructions.trim()}`);
  }

  return `\n\n--- AGENT PERSONA ---\n${lines.join("\n")}\n--- END PERSONA ---`;
}

export interface ProcessMessageInput {
  workspaceId: string;
  channel: Channel;
  channelId: string;
  contactIdentifier: string;
  contactProfile: Record<string, string>;
  content: string;
}

export interface ProcessMessageResult {
  response: string;
  agentUsed: AgentType;
  escalated: boolean;
  leadId?: string;
  tokensUsed?: number;
  latencyMs?: number;
}

export async function processMessage(
  input: ProcessMessageInput
): Promise<ProcessMessageResult> {
  const start = Date.now();
  const { workspaceId, channel, channelId, contactIdentifier, contactProfile, content } = input;

  // ── 0. Load workspace AI config + knowledge base + persona in parallel ──────
  const [ollamaCfg, kbEntries, persona] = await Promise.all([
    getOllamaConfig(workspaceId),
    db.knowledgeBase.findMany({
      where: { workspaceId, isActive: true },
      orderBy: { createdAt: "desc" },
    }),
    // Fall back to ANY persona if none is marked default, so the agent
    // always has persona context (prevents silent failures when isDefault
    // wasn't set during seeding or persona creation)
    db.agentPersona.findFirst({
      where: { workspaceId },
      orderBy: { isDefault: "desc" }, // default persona first, any persona as fallback
    }),
  ]);

  // DEBUG: log persona state so we can see exactly what the AI sees
  console.log(`[conversationEngine] workspaceId=${workspaceId}`);
  console.log(`[conversationEngine] persona found:`, persona ? JSON.stringify({ id: persona.id, name: persona.name, instructions: persona.instructions, isDefault: persona.isDefault }) : "NULL");

  // Build knowledge base context string
  const knowledgeContext = kbEntries.length > 0
    ? "\n\n--- BUSINESS KNOWLEDGE BASE ---\n" +
      kbEntries.map((e) => `[${e.category.toUpperCase()}] ${e.title}\n${e.content}`).join("\n\n") +
      "\n--- END KNOWLEDGE BASE ---"
    : "";

  // Build persona context string using the structured builder
  const personaContext = buildPersonaContext(persona);
  console.log(`[conversationEngine] personaContext length: ${personaContext.length} chars`);
  if (personaContext.length > 0) {
    const snippet = personaContext.slice(0, 200).replace(/\n/g, " | ");
    console.log(`[conversationEngine] personaContext preview: ${snippet}...`);
  }

  // ── 1. Get or create contact ──────────────────────────────────────────────
  const contact = await db.contact.upsert({
    where: {
      workspaceId_channel_channelIdentifier: {
        workspaceId,
        channel,
        channelIdentifier: contactIdentifier,
      },
    },
    update: { profile: contactProfile },
    create: {
      workspaceId,
      channel,
      channelIdentifier: contactIdentifier,
      profile: contactProfile,
    },
  });

  // ── 2. Get or create conversation ─────────────────────────────────────────
  const conversation = await db.conversation.upsert({
    where: {
      workspaceId_channel_channelId: { workspaceId, channel, channelId },
    },
    update: { status: "ACTIVE" },
    create: {
      workspaceId,
      channel,
      channelId,
      contactId: contact.id,
      status: "ACTIVE",
    },
  });

  // ── 3. Load conversation history ─────────────────────────────────────────
  const historyRows = await db.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  const history: AiMessage[] = historyRows.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  // ── 4. Escalation check — hand off to human if conditions are met ────────────
  const escalation = await shouldEscalate(content, history, knowledgeContext);
  if (escalation.escalate) {
    console.log(`[conversationEngine] ESCALATING: ${escalation.reason} (severity: ${escalation.severity})`);

    await db.conversation.update({
      where: { id: conversation.id },
      data: { status: "ESCALATED" },
    });

    const handoverMessage =
      escalation.severity === "high"
        ? "أقدّر تواصلك! سأنقلك إلى أحد أعضاء فريقنا لمساعدتك بشكل شخصي. 😊"
        : "أقدّر تواصلك! سأنقلك إلى أحد أعضاء فريقنا الآن. 😊";

    await db.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: handoverMessage,
      },
    });

    return {
      response: handoverMessage,
      agentUsed: "ROUTER",
      leadId: undefined,
      escalated: true,
      latencyMs: Date.now() - start,
    };
  }

  // ── 5. Route to appropriate agent ─────────────────────────────────────────
  const aiOpts = { ollamaUrl: ollamaCfg.ollamaUrl, model: ollamaCfg.ollamaModel };

  const routing = await routerAgent(
    workspaceId,
    content,
    history,
    aiOpts,
    knowledgeContext,
    personaContext
  );

  let agentResponse: string;
  let agentType: AgentType = routing.agentType;
  let leadId: string | undefined;

  switch (routing.agentType) {
    case "LEAD_QUALIFICATION": {
      const result = await leadQualificationAgent(
        workspaceId,
        contact,
        content,
        history,
        aiOpts,
        knowledgeContext,
        personaContext
      );
      agentResponse = result.response;
      const lead = await db.lead.findFirst({ where: { workspaceId, contactId: contact.id } });
      leadId = lead?.id;
      break;
    }

    case "SUPPORT": {
      const result = await supportAgent(
        workspaceId,
        contact,
        conversation,
        content,
        history,
        aiOpts,
        knowledgeContext,
        personaContext
      );
      agentResponse = result.response;
      break;
    }

    case "BOOKING": {
      const result = await bookingAgent(
        workspaceId,
        contact,
        conversation,
        content,
        history,
        aiOpts,
        knowledgeContext,
        personaContext
      );
      agentResponse = result.response;
      break;
    }

    default:
    case "ROUTER": {
      agentResponse =
        "Got your message! I'm here to help. Could you give me a bit more detail so I can point you in the right direction?";
      break;
    }
  }

  // ── 5b. Safety net: never send raw JSON to the customer ────────────────────
  if (typeof agentResponse !== "string" || !agentResponse.trim() || agentResponse.startsWith("{")) {
    console.error("[conversationEngine] agentResponse was garbage, replacing with fallback", {
      agentUsed: agentType,
      responsePreview: String(agentResponse).slice(0, 100),
    });
    agentResponse = "أهلاً! أنا هنا لمساعدتك. ممكن تحكيلي أكثر عن اللي بتحتاجه؟ 😊";
  }

  // ── 6. Persist messages ───────────────────────────────────────────────────
  await db.message.createMany({
    data: [
      { conversationId: conversation.id, role: "USER", content },
      { conversationId: conversation.id, role: "ASSISTANT", content: agentResponse },
    ],
  });

  // ── 7. Update transcript ───────────────────────────────────────────────────
  await db.transcript.upsert({
    where: { conversationId: conversation.id },
    update: {
      messages: {
        push: [
          { role: "user", content, ts: new Date().toISOString() },
          { role: "assistant", content: agentResponse, ts: new Date().toISOString() },
        ],
      },
    },
    create: {
      workspaceId,
      conversationId: conversation.id,
      messages: [
        { role: "user", content, ts: new Date().toISOString() },
        { role: "assistant", content: agentResponse, ts: new Date().toISOString() },
      ],
    },
  });

  const latencyMs = Date.now() - start;

  return {
    response: agentResponse,
    agentUsed: agentType,
    escalated: false,
    leadId,
    latencyMs,
  };
}
