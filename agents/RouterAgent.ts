import { aiComplete, type AiMessage } from "@/lib/ai";
import { db } from "@/lib/db";
import type { AgentType } from "@prisma/client";

export interface RouterDecision {
  intent: string;
  confidence: number; // 0-1
  agentType: AgentType;
  reasoning: string;
}

const INTENT_PROMPTS: Record<string, string> = {
  // Lead qualification triggers
  new_inquiry: "Customer is asking about product, pricing, or getting started",
  demo_request: "Customer explicitly wants a demo or to speak with sales",
  
  // Booking triggers
  book_appointment: "Customer wants to book a call, meeting, or appointment",
  check_availability: "Customer is asking about available times",
  
  // Support triggers
  ask_help: "Customer is asking for help with something",
  technical_support: "Customer has a technical issue or bug",
  refund_request: "Customer is asking about refunds or cancellations",
  complaint: "Customer is expressing frustration or complaining",
  
  // General
  general: "General conversation, not clearly one of the above",
  escalate: "Customer explicitly wants a human / real person / supervisor",
  out_of_scope: "Customer is asking something we cannot or should not handle",
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
  escalate: "ROUTER", // Router handles escalation — calls human
  out_of_scope: "ROUTER",
};

export async function routerAgent(
  workspaceId: string,
  message: string,
  conversationHistory: AiMessage[]
): Promise<RouterDecision> {
  const systemPrompt = `You are the Router Agent for Rana, an AI customer service platform for MENA businesses.
Your job is to classify the customer's intent from their latest message and route them to the correct specialist agent.

Classification categories:
${Object.entries(INTENT_PROMPTS)
  .map(([key, desc]) => `- ${key}: ${desc}`)
  .join("\n")}

Important rules:
- "escalate" takes highest priority — if customer says "real person", "human", "talk to agent", "supervisor", classify as escalate
- "out_of_scope" only if the message is completely unrelated to the business (spam, personal messages, etc.)
- "complaint" and "refund_request" route to SUPPORT — those agents know how to handle it

Respond ONLY with a JSON object:
{
  "intent": "<one of the intent keys>",
  "confidence": <0.0 to 1.0>,
  "agentType": "<agent type enum>",
  "reasoning": "<2-3 sentence explanation>"
}`;

  const messages: AiMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-6), // last 3 exchanges
    { role: "user", content: `Customer message to classify: "${message}"` },
  ];

  const response = await aiComplete(messages);

  try {
    const parsed = JSON.parse(response.content) as RouterDecision;
    return {
      ...parsed,
      agentType: AGENT_ROUTING[parsed.intent] ?? "ROUTER",
    };
  } catch {
    // Fallback: safe default
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
    "投诉", "怒", "cancel my account", "refund now", "speak to someone",
    "مشغل", "إنسان", "موظف", // Arabic triggers
  ];

  const lowerMessage = message.toLowerCase();
  for (const keyword of escalationKeywords) {
    if (lowerMessage.includes(keyword)) {
      return { escalate: true, reason: `Keyword match: "${keyword}"` };
    }
  }

  // Sentiment-based escalation (future: add sentiment scoring here)
  return { escalate: false };
}
