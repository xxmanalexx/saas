import { aiComplete, type AiMessage } from "@/lib/ai";
import { db } from "@/lib/db";
import type { Contact, Lead } from "@prisma/client";

export interface QualificationResult {
  score: number; // 0-100
  stage: "NEW" | "CONTACTED" | "QUALIFIED";
  responses: Record<string, string>;
  summary: string;
  suggestedAction: "call" | "email" | "book" | "nurture" | "discard";
}

interface LeadQualConfig {
  workspaceId: string;
  qualificationQuestions: string[];
  scoreThresholds: { hot: number; warm: number; cold: number };
}

const DEFAULT_QUAL_QUESTIONS = [
  "What business are you in?",
  "What's your main challenge right now?",
  "What's your budget range?",
  "When are you looking to get started?",
  "What's the best way to reach you?",
];

const SCORING_KEYWORDS: Record<string, number> = {
  // Positive signals
  "asap": 15, "immediately": 15, "urgent": 15,
  "ready to buy": 20, "ready today": 20, "sign up now": 20,
  "budget": 10, "have budget": 15, " allocated": 10,
  "decision maker": 15, "i decide": 10, "owner": 10,
  "big": 8, "large": 8, "enterprise": 12, "scale": 8,
  "mena": 5, "dubai": 5, "saudi": 5, "UAE": 5,
  // Negative signals
  "maybe": -5, "sometime": -5, "not sure": -8,
  "just looking": -10, "browsing": -8, "thinking": -5,
  "cheap": -5, "free": -8, "trial": -3,
};

function scoreMessage(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const [keyword, value] of Object.entries(SCORING_KEYWORDS)) {
    if (lower.includes(keyword)) score += value;
  }
  return Math.max(0, Math.min(100, score));
}

export async function leadQualificationAgent(
  workspaceId: string,
  contact: Contact,
  incomingMessage: string,
  conversationHistory: AiMessage[],
  config?: Partial<LeadQualConfig>
): Promise<QualificationResult & { response: string }> {
  const questions = config?.qualificationQuestions ?? DEFAULT_QUAL_QUESTIONS;

  // Get existing lead if any
  const existingLead = await db.lead.findFirst({
    where: { workspaceId, contactId: contact.id },
    include: { contact: true },
  });

  // Score the incoming message
  const messageScore = scoreMessage(incomingMessage);
  const historyScore = conversationHistory
    .filter((m) => m.role === "user")
    .reduce((sum, m) => sum + scoreMessage(m.content), 0);

  const totalScore = Math.min(
    100,
    (existingLead?.score ?? 0) + messageScore + Math.round(historyScore / 3)
  );

  const answeredCount = existingLead
    ? Object.keys(JSON.parse(JSON.stringify(existingLead))?.notes ?? "{}").length
    : 0;

  // Determine next question
  const nextQuestionIndex = answeredCount;
  const nextQuestion = questions[nextQuestionIndex] ?? null;

  // Build response
  let response: string;
  let suggestedAction: QualificationResult["suggestedAction"] = "nurture";

  if (nextQuestion) {
    // Continue qualification flow
    response = `Thanks for your message! To help me connect you with the right solution, could you tell me: ${nextQuestion}`;
  } else {
    // Qualification complete
    const stage =
      totalScore >= (config?.scoreThresholds?.hot ?? 60)
        ? "QUALIFIED"
        : totalScore >= (config?.scoreThresholds?.warm ?? 30)
        ? "CONTACTED"
        : "NEW";

    response = buildSummaryResponse(totalScore, stage);
    suggestedAction =
      stage === "QUALIFIED"
        ? "book"
        : stage === "CONTACTED"
        ? "call"
        : "nurture";
  }

  // Update lead
  const leadData = {
    score: totalScore,
    stage: existingLead?.stage ?? ("NEW" as const),
    notes: existingLead?.notes
      ? JSON.parse(existingLead.notes as string)
      : {},
  };
  leadData.notes[incomingMessage.slice(0, 100)] = incomingMessage;

  const lead = existingLead
    ? await db.lead.update({
        where: { id: existingLead.id },
        data: { score: totalScore, notes: JSON.stringify(leadData.notes) },
      })
    : await db.lead.create({
        data: {
          workspaceId,
          contactId: contact.id,
          score: totalScore,
          stage: "NEW",
          notes: JSON.stringify(leadData.notes),
        },
      });

  // Log qualification event
  await db.leadEvent.create({
    data: {
      leadId: lead.id,
      type: "qualification_update",
      data: { score: totalScore, message: incomingMessage.slice(0, 200) },
    },
  });

  return {
    score: totalScore,
    stage: "QUALIFIED" as const,
    responses: leadData.notes,
    summary: `Lead scored ${totalScore}/100`,
    suggestedAction,
    response,
  };
}

function buildSummaryResponse(score: number, stage: string): string {
  if (stage === "QUALIFIED" || score >= 60) {
    return `Great — based on what you've shared, you sound like a strong fit. I'd love to set up a quick call to walk you through how Rana can help your business. When works best for you?`;
  }
  if (stage === "CONTACTED" || score >= 30) {
    return `Thanks for reaching out! I'll pass your details to our team and someone will be in touch soon. In the meantime, feel free to explore our website.`;
  }
  return `Thanks for your interest! We'll be in touch when the time is right for you.`;
}
