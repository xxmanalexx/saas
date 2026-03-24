import { db } from "@/lib/db";
import { routerAgent, shouldEscalate } from "@/agents/RouterAgent";
import { leadQualificationAgent } from "@/agents/LeadQualificationAgent";
import { supportAgent } from "@/agents/SupportAgent";
import { bookingAgent } from "@/agents/BookingAgent";
import { followUpAgent } from "@/agents/FollowUpAgent";
import type { AiMessage } from "@/lib/ai";
import type { Channel, Conversation, Contact } from "@prisma/client";
import type { AgentType } from "@prisma/client";

export interface ProcessMessageInput {
  workspaceId: string;
  channel: Channel;
  channelId: string; // WhatsApp number, IG username, web chat session ID, email
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

  // ── 3. Load conversation history ──────────────────────────────────────────
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
    await db.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: "Of course — let me connect you with our team. Someone will be in touch shortly.",
        metadata: { reason: escalateCheck.reason },
      },
    });
    await db.conversation.update({
      where: { id: conversation.id },
      data: { status: "ESCALATED" },
    });
    return {
      response: "Of course — let me connect you with our team. Someone will be in touch shortly.",
      agentUsed: "ROUTER",
      escalated: true,
      latencyMs: Date.now() - start,
    };
  }

  // ── 5. Route to appropriate agent ─────────────────────────────────────────
  const routing = await routerAgent(workspaceId, content, history);

  let agentResponse: string;
  let agentType: AgentType = routing.agentType;
  let leadId: string | undefined;

  switch (routing.agentType) {
    case "LEAD_QUALIFICATION": {
      const result = await leadQualificationAgent(
        workspaceId,
        contact,
        content,
        history
      );
      agentResponse = result.response;
      // Get lead ID
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
        history
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
        history
      );
      agentResponse = result.response;
      break;
    }

    default:
    case "ROUTER": {
      // Generic fallback response
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
