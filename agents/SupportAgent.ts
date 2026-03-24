import { aiComplete, type AiMessage, type AiOptions } from "@/lib/ai";
import { db } from "@/lib/db";
import type { Contact, Conversation } from "@prisma/client";

export interface SupportResult {
  resolved: boolean;
  category?: string;
  response: string;
  escalate: boolean;
}

const FAQ_ANSWERS: Record<string, string> = {
  "pricing": "Rana offers three plans: Starter at $49/mo, Growth at $149/mo, and Enterprise at $499/mo. All plans include our AI agents. Want me to walk you through which fits your business?",
  "demo": "Happy to arrange a demo! Can you share your preferred time and timezone?",
  "cancel": "I can help you manage your subscription. Would you like to pause, downgrade, or cancel entirely?",
  "refund": "Our refund policy allows cancellations within 7 days of billing. I'll flag this for our team — someone will be in touch within 24 hours.",
  "hours": "We operate Monday to Friday, 9 AM to 6 PM (UAE time). Outside hours, our AI handles everything — urgent issues can be escalated.",
  "integration": "Rana connects with WhatsApp, Instagram, web chat, email, HubSpot, Zoho, Pipedrive, Cal.com, and Stripe. Which would you like to set up?",
};

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

  // Keyword-based FAQ matching
  for (const [keyword, answer] of Object.entries(FAQ_ANSWERS)) {
    if (lowerMsg.includes(keyword)) {
      // Try to attach to existing lead
      const leadId = await getLeadId(workspaceId, contact.id);
      if (leadId) {
        await db.leadEvent.create({
          data: {
            leadId,
            type: "support_faq",
            data: { keyword, question: incomingMessage },
          },
        }).catch(() => {});
      }

      return {
        resolved: true,
        category: keyword,
        response: answer,
        escalate: false,
      };
    }
  }

  // Fallback: AI-powered response
  const systemPrompt = `You are a helpful customer support agent for Rana, an AI platform for MENA businesses.
Answer questions about: pricing, demos, integrations, billing, cancellations, refunds, and general product questions.
Be friendly, concise, and professional.
If you don't know something, say you'll escalate to the team.
Never make up pricing or facts — stick to what's provided in the conversation.`;

  const messages: AiMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-6),
    { role: "user", content: incomingMessage },
  ];

  const response = await aiComplete(messages);

  return {
    resolved: false,
    response: response.content,
    escalate: false,
  };
}

async function getLeadId(workspaceId: string, contactId: string): Promise<string | null> {
  const lead = await db.lead.findFirst({ where: { workspaceId, contactId } });
  return lead?.id ?? null;
}
