import { aiComplete, type AiMessage, type AiOptions } from "@/lib/ai";
import type { AgentType } from "@prisma/client";

export interface RouterDecision {
  intent: string;
  confidence: number;
  agentType: AgentType;
  reasoning: string;
}

const INTENT_PROMPTS: Record<string, string> = {
  new_inquiry: "Customer is asking about product, pricing, or getting started",
  demo_request: "Customer explicitly wants a demo or to speak with sales",
  book_appointment: "Customer wants to book a call, meeting, or appointment",
  check_availability: "Customer is asking about available times",
  ask_help: "Customer is asking for help with something",
  technical_support: "Customer has a technical issue or bug",
  refund_request: "Customer is asking about refunds or cancellations",
  complaint: "Customer is expressing frustration or complaining",
  general: "General conversation, not clearly one of the above",
  escalate: "Customer explicitly wants a human / real person / supervisor",
  out_of_scope: "Customer is asking something completely unrelated",
};

const AGENT_ROUTING: Record<string, AgentType> = {
  new_inquiry: "LEAD_QUALIFICATION",
  demo_request: "LEAD_QUALIFICATION",
  book_appointment: "BOOKING",
  check_availability: "BOOKING",
  ask_help: "SUPPORT",
  technical_support: "SUPPORT",
  refund_request: "SUPPORT",
  complaint: "SUPPORT",
  general: "LEAD_QUALIFICATION",
  escalate: "ROUTER",
  out_of_scope: "ROUTER",
};

export async function routerAgent(
  workspaceId: string,
  message: string,
  conversationHistory: AiMessage[],
  aiOpts?: AiOptions,
  knowledgeContext?: string,
  personaContext?: string
): Promise<RouterDecision> {
  // Persona FIRST so it shapes the entire response
  const systemPrompt =
    (personaContext ?? "") +
    `\n\nYou are the Router Agent for Rana, an AI customer service platform for MENA businesses.` +
    `Your job is to classify the customer's intent and route them to the correct specialist agent.` +
    (knowledgeContext ?? "") +
    `\n\nClassification categories:\n` +
    Object.entries(INTENT_PROMPTS)
      .map(([key, desc]) => `- ${key}: ${desc}`)
      .join("\n") +
    `\n\nImportant rules:
- "escalate" takes highest priority — if customer says "real person", "human", "talk to agent", classify as escalate
- "out_of_scope" only for completely unrelated messages (spam, personal messages)
- "complaint" and "refund_request" route to SUPPORT
- When in doubt, route to LEAD_QUALIFICATION

Respond ONLY with a JSON object with keys: intent, confidence, agentType, reasoning`;

  const messages: AiMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-6),
    { role: "user", content: `Customer message to classify: "${message}"` },
  ];

  const response = await aiComplete(messages, aiOpts);

  try {
    const parsed = JSON.parse(response.content) as RouterDecision;
    return {
      ...parsed,
      agentType: AGENT_ROUTING[parsed.intent] ?? "ROUTER",
    };
  } catch {
    return {
      intent: "general",
      confidence: 0.5,
      agentType: "LEAD_QUALIFICATION",
      reasoning: "Could not parse routing decision, defaulting to lead qualification.",
    };
  }
}

export async function shouldEscalate(
  message: string,
  conversationHistory: AiMessage[]
): Promise<{ escalate: boolean; reason?: string }> {
  const escalationKeywords = [
    "talk to a human", "real person", "human", "supervisor", "manager",
    "complaint", "怒", "cancel my account", "refund now", "speak to someone",
    "مشغل", "إنسان", "موظف",
  ];

  const lowerMessage = message.toLowerCase();
  for (const keyword of escalationKeywords) {
    if (lowerMessage.includes(keyword)) {
      return { escalate: true, reason: `Keyword match: "${keyword}"` };
    }
  }

  return { escalate: false };
}
