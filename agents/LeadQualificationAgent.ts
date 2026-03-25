import { aiComplete, type AiMessage, type AiOptions } from "@/lib/ai";
import { db } from "@/lib/db";
import type { Contact } from "@prisma/client";

export interface QualificationResult {
  score: number;
  stage: "NEW" | "CONTACTED" | "QUALIFIED";
  responses: Record<string, string>;
  summary: string;
  suggestedAction: "call" | "email" | "book" | "nurture" | "discard";
}

const QUAL_QUESTIONS = [
  "What business are you in?",
  "What's your main challenge right now?",
  "What's your budget range?",
  "When are you looking to get started?",
  "What's the best way to reach you?",
];

export async function leadQualificationAgent(
  workspaceId: string,
  contact: Contact,
  incomingMessage: string,
  conversationHistory: AiMessage[],
  aiOpts?: AiOptions,
  knowledgeContext?: string,
  personaContext?: string,
): Promise<QualificationResult & { response: string }> {
  // Get existing lead
  const existingLead = await db.lead.findFirst({
    where: { workspaceId, contactId: contact.id },
  });

  const answeredCount = existingLead
    ? Object.keys(JSON.parse(JSON.stringify(existingLead.notes ?? "{}"))).length
    : 0;
  const nextQuestion = QUAL_QUESTIONS[answeredCount] ?? null;

  // ── Continue qualification flow ─────────────────────────────────────────────
  if (nextQuestion) {
    // Persist user's answer
    if (existingLead) {
      const notes = JSON.parse(existingLead.notes as string ?? "{}");
      notes[incomingMessage.slice(0, 80)] = incomingMessage;
      await db.lead.update({
        where: { id: existingLead.id },
        data: { notes: JSON.stringify(notes) },
      });
    } else {
      await db.lead.create({
        data: {
          workspaceId,
          contactId: contact.id,
          score: 0,
          stage: "NEW",
          notes: JSON.stringify({ [incomingMessage.slice(0, 80)]: incomingMessage }),
        },
      });
    }

    // Persona FIRST so it shapes the conversation style
    const systemPrompt =
      (personaContext ?? "") +
      `\n\nYou are a lead qualification agent.` +
      (knowledgeContext ?? "") +
      `\n\nYour job is to qualify the lead by asking up to 5 key questions.
Ask one question at a time. Be friendly and conversational.
After 3+ answers, make a judgment and give a recommendation.`;

    const messages: AiMessage[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-8),
      { role: "user", content: `The customer said: "${incomingMessage}"\n\nAsk them naturally: ${nextQuestion}` },
    ];

    const result = await aiComplete(messages, aiOpts);

    return {
      score: existingLead?.score ?? 0,
      stage: "NEW",
      responses: {},
      summary: "In qualification flow",
      suggestedAction: "nurture",
      response: result.content,
    };
  }

  // ── Qualification complete — AI makes a final recommendation ───────────────
  const systemPrompt =
    (personaContext ?? "") +
    `You are a lead qualification agent for Rana.` +
    (knowledgeContext ?? "") +
    `\n\nBased on the customer's previous answers, determine:
1. Their fit score: HOT (ready to buy, clear budget, timeline), WARM (interested, timeline vague), COLD (early stage, exploring)
2. Recommended next action: book (for HOT), call (for WARM), nurture (for COLD)
3. A brief summary of their needs

Respond ONLY as JSON with fields: score (0-100), stage (HOT|WARM|COLD), summary (1 sentence), suggestedAction (book|call|nurture), response (what to tell the customer — be friendly and natural).`;

  const messages: AiMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-12),
    { role: "user", content: "Based on the above conversation, provide the qualification result as JSON." },
  ];

  const result = await aiComplete(messages, aiOpts);

  let parsed: { score: number; stage: string; suggestedAction: string; summary: string; response: string } = {
    score: 50, stage: "WARM", suggestedAction: "nurture", summary: "", response: result.content,
  };
  try {
    const raw = JSON.parse(result.content);
    parsed = {
      score: Number(raw.score) || Number(raw.qualifications?.fit_score) || 50,
      stage: String(raw.stage ?? raw.qualifications?.stage ?? "WARM"),
      suggestedAction: String(raw.suggestedAction ?? "nurture"),
      summary: String(raw.summary ?? ""),
      response: typeof raw.response === "string" ? raw.response : result.content,
    };
  } catch { /* use defaults */ }

  // Guard: if response still looks like JSON (parse succeeded but response field
  // contained nested JSON, not a readable string), fall back to raw content
  let finalResponse = parsed.response;
  if (!finalResponse || finalResponse.startsWith("{")) {
    console.warn("[LeadQualificationAgent] response was not a readable string, using raw content");
    finalResponse = result.content.trim();
  }

  const stageMap: Record<string, "QUALIFIED" | "CONTACTED" | "NEW"> = {
    HOT: "QUALIFIED", WARM: "CONTACTED", COLD: "NEW",
  };
  const dbStage = stageMap[parsed.stage] ?? "CONTACTED";
  const responseAction = parsed.suggestedAction as "book" | "call" | "nurture";

  if (existingLead) {
    await db.lead.update({ where: { id: existingLead.id }, data: { score: parsed.score, stage: dbStage } });
    await db.leadEvent.create({ data: { leadId: existingLead.id, type: "qualification_complete", data: { score: parsed.score, stage: parsed.stage } } });
  }

  return {
    score: parsed.score,
    stage: dbStage,
    responses: JSON.parse(existingLead?.notes as string ?? "{}"),
    summary: parsed.summary,
    suggestedAction: responseAction,
    response: finalResponse,
  };
}
