import { db } from "@/lib/db";
import { aiCompleteSimple } from "@/lib/ai";
import { getOllamaConfig } from "@/lib/ollamaConfig";
import { sendWhatsAppMessage } from "@/lib/whatsappBaileys";

export interface FollowUpResult {
  sent: boolean;
  conversationId: string;
  channel: string;
  response: string;
}

/**
 * Find all active conversations that need a follow-up message and send them.
 * Called by the cron job.
 */
export async function runFollowUpJob(workspaceId: string): Promise<FollowUpResult[]> {
  const results: FollowUpResult[] = [];

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      followUpEnabled: true,
      followUpDelayMinutes: true,
      followUpInstructions: true,
      followUpMessage: true,
    },
  });

  if (!workspace?.followUpEnabled) {
    return results;
  }

  const delayMs = (workspace.followUpDelayMinutes ?? 300) * 60 * 1000;
  const cutoff = new Date(Date.now() - delayMs);

  // Find active conversations where:
  // 1. No follow-up has been sent yet
  // 2. The last message is from the CUSTOMER (AI should not double-message)
  // 3. The last customer message is older than the configured delay
  const conversations = await db.conversation.findMany({
    where: {
      workspaceId,
      status: "ACTIVE",
      followUpSentAt: null,
      messages: {
        some: {
          role: "USER",
        },
      },
    },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      contact: true,
    },
  });

  for (const conv of conversations) {
    const lastMsg = conv.messages[0];
    if (!lastMsg || lastMsg.role !== "USER") continue;

    // Only follow up if the last customer message is old enough
    if (lastMsg.createdAt > cutoff) continue;

    // Use workspace message template, or a sensible default
    const baseMessage = workspace.followUpMessage?.trim()
      || "Hi! Just checking in — are you still there? I'd love to help if you have any questions. 😊";

    let finalMessage = baseMessage;

    // If AI guidance is provided, ask the AI to tailor the message
    if (workspace.followUpInstructions?.trim()) {
      const contactName =
        (conv.contact?.profile as Record<string, string>)?.name ?? "there";

      const systemPrompt = `You are a helpful sales assistant. The customer's name is "${contactName}".`;
      const userPrompt = `Based on this conversation context, write a short, friendly follow-up message (max 2 sentences) to send to the customer. Do NOT be pushy. Do NOT mention "AI" or "automated".

Customer's name: ${contactName}

AI Guidance: ${workspace.followUpInstructions}

Write ONLY the message in Arabic or English as appropriate. No quotes, no explanation.`;

      try {
        const aiResult = await aiCompleteSimple(userPrompt, systemPrompt, {
          temperature: 0.7,
          timeoutMs: 30_000,
        });
        // Only use the AI response if it looks valid — not the Arabic timeout error
        const isOllamaError =
          !aiResult.content ||
          aiResult.content.includes("استغرق الرد وقتاً") ||
          aiResult.content.includes("timeout") ||
          aiResult.content.length < 3;
        if (!isOllamaError) {
          finalMessage = aiResult.content.trim();
        }
        // else: Ollama failed → keep baseMessage as fallback
      } catch (err) {
        // Ollama unavailable or auth error — fall back to template silently
        console.warn(`[FollowUpAgent] AI tailoring failed, using template: ${err}`);
      }
    }

    // Send via WhatsApp
    if (conv.channel === "WHATSAPP" && conv.channelId) {
      try {
        await sendWhatsAppMessage(conv.channelId, finalMessage);
        await db.conversation.update({
          where: { id: conv.id },
          data: { followUpSentAt: new Date() },
        });
        await db.message.create({
          data: {
            conversationId: conv.id,
            role: "ASSISTANT",
            content: finalMessage,
          },
        });
        await db.agentLog.create({
          data: {
            agentId: "follow-up",
            input: { conversationId: conv.id, type: "auto_follow_up" },
            output: { response: finalMessage, channel: conv.channel },
          },
        }).catch(() => {});
        results.push({
          sent: true,
          conversationId: conv.id,
          channel: conv.channel,
          response: finalMessage,
        });
      } catch (err) {
        console.error(`[FollowUpAgent] Failed to send to ${conv.channelId}:`, err);
      }
    }
  }

  return results;
}
