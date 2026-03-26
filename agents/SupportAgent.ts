import { aiComplete, type AiMessage, type AiOptions } from "@/lib/ai";
import { db } from "@/lib/db";
import type { Contact, Conversation } from "@/generated/prisma";

export interface SupportResult {
  resolved: boolean;
  category?: string;
  response: string;
  escalate: boolean;
}

export async function supportAgent(
  workspaceId: string,
  contact: Contact,
  conversation: Conversation,
  incomingMessage: string,
  history: AiMessage[],
  aiOpts?: AiOptions,
  knowledgeContext?: string,
  personaContext?: string,
): Promise<SupportResult & { response: string }> {
  const lowerMsg = incomingMessage.toLowerCase();

  // ── Keyword FAQ using knowledge base ──────────────────────────────────────
  if (knowledgeContext) {
    const kbLines = knowledgeContext.split("\n").filter(Boolean);
    // Try to find a matching KB entry by keyword proximity
    const msgWords = lowerMsg.split(/\s+/);
    for (const line of kbLines) {
      if (line.startsWith("[") && line.includes("]")) {
        const tagMatch = line.match(/\[(\w+)\]/);
        const tag = tagMatch?.[1] ?? "";
        const content = kbLines[kbLines.indexOf(line) + 1] ?? "";
        if (msgWords.some((w: string) => w.length > 3 && content.toLowerCase().includes(w))) {
          return {
            resolved: true,
            category: tag,
            response: content.trim(),
            escalate: false,
          };
        }
      }
    }
  }

  // ── Keyword fallback answers ───────────────────────────────────────────────
  const FAQ_ANSWERS: Record<string, string> = {
    pricing: "Rana has three plans: Starter $49/mo, Growth $149/mo, Enterprise $499/mo. Want me to help you find the right fit?",
    demo: "Happy to arrange a demo! What time and timezone works best for you?",
    cancel: "I can help with that. Would you like to pause, downgrade, or cancel?",
    refund: "We offer a 14-day money-back guarantee. I'll flag this for our team — someone will reach out within 24 hours.",
    hours: "We're available Sunday–Thursday, 9 AM to 6 PM GST. Outside hours, our AI handles everything!",
    integration: "Rana connects with WhatsApp, Instagram, web chat, email, HubSpot, Zoho, Pipedrive, and Cal.com. Which would you like to set up?",
  };

  for (const [keyword, answer] of Object.entries(FAQ_ANSWERS)) {
    if (lowerMsg.includes(keyword)) {
      return {
        resolved: true,
        category: keyword,
        response: answer,
        escalate: false,
      };
    }
  }

  // ── AI-powered fallback ───────────────────────────────────────────────────
  const systemPrompt =
    (personaContext ?? "") +
    `You are a customer support agent.` +
    (knowledgeContext ?? "") +
    `\n\nFollow these rules:
- Only answer questions using information from the knowledge base above
- If the knowledge base doesn't cover the question, say you'll escalate to the team
- Be friendly, helpful, and concise
- Never make up pricing, policies, or facts
- In Arabic: respond in Arabic. In English: respond in English.`;

  const messages: AiMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: incomingMessage },
  ];

  const response = await aiComplete(messages, aiOpts);

  return {
    resolved: false,
    response: response.content,
    escalate: false,
  };
}
