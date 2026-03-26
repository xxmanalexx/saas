import { aiComplete, type AiMessage, type AiOptions } from "@/lib/ai";
import type { AgentType } from "@/generated/prisma";

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

  console.log(`[RouterAgent] systemPrompt length: ${systemPrompt.length}`);
  console.log(`[RouterAgent] first 300 chars of prompt:\n${systemPrompt.slice(0, 300)}`);

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

export interface EscalationResult {
  escalate: boolean;
  reason?: string;
  severity?: "medium" | "high";
}

/**
 * Determines if the current conversation should be handed over to a human.
 * Checks three main conditions:
 *  1. Dissatisfaction — customer shows anger, frustration, or negative sentiment
 *  2. Explicit human request — customer asks for human/agent/supervisor
 *  3. Knowledge gap — customer asks something AI clearly can't answer accurately
 */
export async function shouldEscalate(
  message: string,
  conversationHistory: AiMessage[],
  knowledgeContext: string
): Promise<EscalationResult> {
  const lowerMessage = message.toLowerCase().trim();

  // ── Condition 1: Explicit human request (highest priority) ───────────────
  const humanKeywords = [
    // English
    "talk to a human", "real person", "human agent", "speak to someone",
    "speak to a manager", "speak to supervisor", "I want a real person",
    "connect me to an agent", "let me talk to someone", "real support",
    "customer service", "talk to support",
    // Arabic
    "موظف", "شخص حقيقي", "إنسان", "مدير", "مشرف", "عامل",
    "تحدث مع موظف", "شخص حقيقي", "أنسان",
    // Romanized Arabic
    "moozam", "insan", "modir", "mushrif",
  ];

  for (const keyword of humanKeywords) {
    if (lowerMessage.includes(keyword)) {
      return {
        escalate: true,
        reason: `Customer explicitly requested human assistance: "${keyword}"`,
        severity: "high",
      };
    }
  }

  // ── Condition 2: Dissatisfaction signals ──────────────────────────────────
  const dissatisfactionPatterns = [
    // English frustration
    /\b(worst|terrible|horrible|awful|hate|angry|mad|furious)\b/i,
    /\bnot (good|satisfied|happy|helpful)\b/i,
    /\bthis is (unacceptable|ridiculous|absurd)\b/i,
    /\b(i'm|i am) (frustrated|annoyed|disappointed|upset)\b/i,
    /\bgive me (my|them|the) (refund|cancel)\b/i,
    /\bcancel (my|the|this) (order|account|service)\b/i,
    // Arabic
    /أسف|زعلان|غير راضي|محبط|غاضب|ساخط|متضايق/i,
    /ما أكدر|ما أقدر|هذا شي فاشل/i,
    /أبي أسحب|أبي أرجع|طلب إرجاع/i,
    /ما يفيدني|ما نفع|مالح|ما شي ينفع/i,
    // Romanized Arabic
    /\bmot3ayib\b|\bmustageeb\b|\bmazoo3\b/i,
  ];

  for (const pattern of dissatisfactionPatterns) {
    if (pattern.test(message)) {
      return {
        escalate: true,
        reason: `Dissatisfaction signal detected via keyword/pattern`,
        severity: "medium",
      };
    }
  }

  // ── Condition 3: Knowledge gap — AI doesn't have the answer ───────────────
  // If knowledge base is empty or doesn't cover what customer is asking about
  const hasKnowledge = knowledgeContext.length > 100;
  const unknownIndicators = [
    /\b(don't know|don't understand|no idea|i'm not sure)\b/i,
    /\bcan (you|could you) (look it up|check|find out)\b/i,
    /\bthat's not (what i asked|my question|the answer)\b/i,
    /\bnot (what i meant|what i wanted|correct)\b/i,
    /\b(i've|i have) asked (before|this before|multiple times)\b/i,
  ];

  const explicitlyUnsatisfied =
    unknownIndicators.some((p) => p.test(message)) ||
    (message.length > 100 && !hasKnowledge && /\b(how|what|where|when|why|can i|do i)\b/i.test(message));

  if (explicitlyUnsatisfied) {
    return {
      escalate: true,
      reason: "Customer appears unsatisfied with AI's responses or AI lacks knowledge to answer",
      severity: "medium",
    };
  }

  return { escalate: false };
}
