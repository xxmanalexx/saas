import { aiComplete, type AiMessage, type AiOptions } from "@/lib/ai";
import { db } from "@/lib/db";
import type { Contact } from "@/generated/prisma";

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
  }) as { id: string; score: number; notes: string } | null;

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
1. Their fit: HOT (ready to buy), WARM (interested), COLD (early stage)
2. A brief summary of their needs in 1 sentence
3. What to tell the customer next — keep it to 1 short sentence in ARABIC, warm and natural, like a helpful sales person

IMPORTANT: Respond with ONLY a short Arabic sentence the customer can read. Do NOT return JSON. Do NOT wrap your answer in code blocks or triple backticks.`;

  const messages: AiMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-12),
    { role: "user", content: "Based on the customer's answers above, give me a short Arabic sentence to send to the customer." },
  ];

  const result = await aiComplete(messages, aiOpts);

  // We asked for a plain Arabic sentence — use it directly if it looks human-readable
  let finalResponse = result.content.trim();
  if (!finalResponse || finalResponse.startsWith("{") || finalResponse.startsWith("[")) {
    console.warn("[LeadQualificationAgent] unexpected non-human response, using raw:", finalResponse.slice(0, 80));
    finalResponse = "شكراً على تواصلك! أنا هنا لمساعدتك. تحب تحجز تجربة مجانية؟ 🚀";
  }
  // Best-effort score/stage extraction from conversation content (for DB records only)
  let score = 50;
  let dbStage: "QUALIFIED" | "CONTACTED" | "NEW" = "CONTACTED";
  try {
    const scoreMatch = finalResponse.match(/(\d{1,3})%|fit.*?(\d+)/i);
    if (scoreMatch) score = Math.min(100, parseInt(scoreMatch[1] || scoreMatch[2]) || 50);
    if (/جاهز|احتياج|يبك|sready|hot/i.test(finalResponse)) { dbStage = "QUALIFIED"; score = 80; }
    else if (/مهتم| interested |warm/i.test(finalResponse)) { dbStage = "CONTACTED"; score = 50; }
    else if (/لا|مش|not|غير|cold/i.test(finalResponse)) { dbStage = "NEW"; score = 20; }
  } catch { /* keep defaults */ }

  if (existingLead) {
    await db.lead.update({ where: { id: existingLead.id }, data: { score, stage: dbStage } });
    await db.leadEvent.create({ data: { leadId: existingLead.id, type: "qualification_complete", data: JSON.stringify({ score, stage: dbStage }) } });
  }

  return {
    score,
    stage: dbStage,
    responses: JSON.parse(existingLead?.notes as string ?? "{}"),
    summary: "",
    suggestedAction: "nurture" as const,
    response: finalResponse,
  };
}
