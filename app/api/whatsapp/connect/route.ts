import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSocket, getConnectionStatus, sendWhatsAppMessage, sendTypingIndicator } from "@/lib/whatsappBaileys";
import { db } from "@/lib/db";
import { aiStream } from "@/lib/ai";
import { buildPersonaContext } from "@/lib/conversationEngine";
import { getOllamaConfig } from "@/lib/ollamaConfig";
import { transcribeAudio } from "@/lib/whisperTranscriber";
import { triggerFollowUps } from "@/lib/triggerFollowUps";
import type { AiMessage } from "@/lib/ai";
import type { Channel } from "@prisma/client";

// POST /api/whatsapp/connect
// Starts the WhatsApp Baileys socket and wires up AI message processing.
export async function POST(req: NextRequest) {
  const workspaceId = req.headers.get("x-workspace-id") ?? "default";

  // Check if already connected
  const existing = getConnectionStatus();
  if (existing.status === "connected") {
    return NextResponse.json({ ok: true, status: existing, message: "Already connected" });
  }

  try {
    const socket = await getOrCreateSocket(
      workspaceId,
      (qr) => {
        console.log(`[WhatsApp] New QR for workspace ${workspaceId}`);
      },
      async (incoming) => {
        // ── AI message processing ─────────────────────────────────────────
        try {
          const { remoteJid, text: incomingText, pushName, messageId, audioBuffer, mimeType, hasAudio } = incoming;
          let { text } = incoming;
          let usedVoiceNote = false;

          // If this is a voice note without text, transcribe it
          if (!text && hasAudio && audioBuffer) {
            console.log(`[WhatsApp] Received voice note, transcribing...`);
            const result = await transcribeAudio(audioBuffer, mimeType ?? "audio/ogg");
            if (result.success && result.text) {
              text = result.text;
              usedVoiceNote = true;
              console.log(`[WhatsApp] Transcription: "${result.text.slice(0, 60)}"`);
            } else {
              text = "عذراً، ما قدرت أفهم الرسالة الصوتية. ممكن تكتب لي؟ 😊";
              console.log(`[WhatsApp] Transcription failed: ${result.error}`);
            }
          }

          console.log(`[WhatsApp] raw incoming | jid="${remoteJid}" | text="${text}" | fromMe=${incoming.fromMe} | voiceNote=${usedVoiceNote}`);

          if (!text || !remoteJid) {
            console.log(`[WhatsApp] Skipping: missing text or jid`);
            return;
          }

          // ── Group filter ────────────────────────────────────────────────
          // WhatsApp group JIDs always contain @g.us
          const isGroup = remoteJid.includes("@g.us");
          const isNewsletter = remoteJid.includes("@newsletter");
          const isStatus = remoteJid.endsWith("@status.broadcast");
          if (isGroup || isNewsletter || isStatus) {
            console.log(`[WhatsApp] BLOCKED ${isStatus ? "status broadcast" : isNewsletter ? "newsletter" : "group"} message from ${remoteJid} — not responding`);
            return;
          }

          // ── DMs only from here ─────────────────────────────────────────
          const contactIdentifier = remoteJid.replace("@s.whatsapp.net", "");
          console.log(`[WhatsApp] Processing DM from ${contactIdentifier}`);

          // Upsert contact
          const contact = await db.contact.upsert({
            where: { workspaceId_channel_channelIdentifier: { workspaceId, channel: "WHATSAPP" as Channel, channelIdentifier: contactIdentifier } },
            update: {},
            create: {
              workspaceId,
              channel: "WHATSAPP" as Channel,
              channelIdentifier: contactIdentifier,
              profile: { name: pushName ?? "WhatsApp User" },
            },
          });

          // Upsert conversation
          const conversation = await db.conversation.upsert({
            where: { workspaceId_channel_channelId: { workspaceId, channel: "WHATSAPP" as Channel, channelId: remoteJid } },
            update: {},
            create: {
              workspaceId,
              channel: "WHATSAPP" as Channel,
              channelId: remoteJid,
              contactId: contact.id,
            },
          });

          // Store inbound message
          await db.message.create({
            data: {
              conversationId: conversation.id,
              role: "USER",
              content: text,
            },
          });

          // Get conversation history
          const historyRows = await db.message.findMany({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: "asc" },
            take: 20,
          });
          const history: AiMessage[] = historyRows.map(m => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
          }));

          // Get Ollama config, knowledge base, and persona in parallel
          const [ollamaCfg, kbEntries, persona] = await Promise.all([
            getOllamaConfig(workspaceId),
            db.knowledgeBase.findMany({ where: { workspaceId, isActive: true } }),
            db.agentPersona.findFirst({ where: { workspaceId }, orderBy: { isDefault: "desc" } }),
          ]);

          // Build context strings
          const knowledgeContext = kbEntries.length > 0
            ? "\n\n--- BUSINESS KNOWLEDGE BASE ---\n" +
              kbEntries.map(e => `[${e.category.toUpperCase()}] ${e.title}\n${e.content}`).join("\n\n") +
              "\n--- END KNOWLEDGE BASE ---"
            : "";

          const personaContext = buildPersonaContext(persona);

          // Build system prompt
          const systemPrompt =
            personaContext +
            "\n\nYou are a helpful AI assistant." +
            knowledgeContext +
            "\n\nIMPORTANT: Respond in Arabic. Keep responses short and natural.";

          // Accumulate streaming response
          let fullResponse = "";
          const streamMessages: AiMessage[] = [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: text },
          ];

          // Stream tokens and accumulate
          await sendTypingIndicator(remoteJid, true);
          try {
            for await (const token of aiStream(streamMessages, {
              ollamaUrl: ollamaCfg.ollamaUrl,
              model: ollamaCfg.ollamaModel,
              thinking: ollamaCfg.ollamaThinking,
            })) {
              fullResponse += token;
            }
          } catch (err) {
            console.error("[WhatsApp] aiStream error:", err);
            // Timeout or stream error — send fallback so user isn't left hanging
            fullResponse = "عذراً، استغرق الرد وقتاً طويلاً. حاول مرة أخرى.";
          } finally {
            await sendTypingIndicator(remoteJid, false);
          }

          console.log(`[WhatsApp] AI streamed response: "${fullResponse.slice(0, 80)}"`);

          // Send AI response back to WhatsApp
          if (fullResponse) {
            await sendWhatsAppMessage(remoteJid, fullResponse);
          }

          // Store outbound message
          await db.message.create({
            data: {
              conversationId: conversation.id,
              role: "ASSISTANT",
              content: fullResponse,
            },
          });

          // Trigger follow-up check (fire and forget — no await)
          triggerFollowUps(workspaceId);

          // Log the exchange
          await db.agentLog.create({
            data: {
              agentId: "whatsapp-inbound",
              input: { content: text, messageId },
              output: { response: fullResponse, agent: "streaming" },
            },
          }).catch(() => {});
        } catch (err) {
          console.error("[WhatsApp] message processing error:", err);
        }
      }
    );

    // Wait up to 30s for connection
    let waited = 0;
    while (waited < 30000) {
      const status = getConnectionStatus();
      if (status.status === "connected") {
        return NextResponse.json({ ok: true, status });
      }
      if (status.status === "error" || status.status === "disconnected") {
        return NextResponse.json(
          { ok: false, status, error: status.message },
          { status: 500 }
        );
      }
      await new Promise((r) => setTimeout(r, 500));
      waited += 500;
    }

    const timedOut = getConnectionStatus();
    return NextResponse.json(
      { ok: false, status: timedOut, error: "Connection timed out" },
      { status: 408 }
    );
  } catch (err) {
    console.error("[WhatsApp] connect error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
