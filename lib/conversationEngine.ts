import { db } from "@/lib/db";
import { routerAgent, shouldEscalate } from "@/agents/RouterAgent";
import { leadQualificationAgent } from "@/agents/LeadQualificationAgent";
import { supportAgent } from "@/agents/SupportAgent";
import { bookingAgent } from "@/agents/BookingAgent";
import { followUpAgent } from "@/agents/FollowUpAgent";
import { getOllamaConfig } from "@/lib/ollamaConfig";
import type { AiMessage } from "@/lib/ai";
import type { Channel, Conversation, Contact } from "@prisma/client";
import type { AgentType } from "@prisma/client";

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
    db.agentPersona.findFirst({
      where: { workspaceId, isDefault: true },
    }),
  ]);

  // Build knowledge base context string
  const knowledgeContext = kbEntries.length > 0
    ? "\n\n--- BUSINESS KNOWLEDGE BASE ---\n" +
      kbEntries.map((e) => `[${e.category.toUpperCase()}] ${e.title}\n${e.content}`).join("\n\n") +
      "\n--- END KNOWLEDGE BASE ---"
    : "";

  // Build persona context string
  const personaContext = persona
    ? `\n\n--- AGENT PERSONA ---\n` +
      `Name: ${persona.name}\n` +
      `Role: ${persona.role}\n` +
      `Tone: ${persona.tone}\n` +
      `Language: ${persona.language}\n` +
      `Emoji style: ${persona.emojiStyle}\n` +
      (persona.instructions ? `Custom instructions: ${persona.instructions}\n` : "") +
      `--- END PERSONA ---`
    : "";

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

  // ── 4. Check for escalation triggers ─────────────────────────────────────
  const escalateCheck = await shouldEscalate(content, history);
  if (escalateCheck.escalate) {
    const escalationMsg = "Of course — let me connect you with our team. Someone will be in touch shortly.";
    await db.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: escalationMsg,
        metadata: { reason: escalateCheck.reason },
      },
    });
    await db.conversation.update({
      where: { id: conversation.id },
      data: { status: "ESCALATED" },
    });
    return {
      response: escalationMsg,
      agentUsed: "ROUTER",
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
