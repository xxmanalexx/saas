import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSocket, getConnectionStatus, sendWhatsAppMessage } from "@/lib/whatsappBaileys";
import { processMessage } from "@/lib/conversationEngine";
import { db } from "@/lib/db";
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
          const { remoteJid, text, pushName, messageId } = incoming;
          if (!text || !remoteJid) return;

          // Determine contact identifier (phone number from WhatsApp JID)
          const contactIdentifier = remoteJid.replace("@s.whatsapp.net", "");

          // Process through AI agents + Ollama
          const result = await processMessage({
            workspaceId,
            channel: "WHATSAPP" as Channel,
            channelId: remoteJid,
            contactIdentifier,
            contactProfile: {
              name: pushName ?? "WhatsApp User",
              phone: contactIdentifier,
            },
            content: text,
          });

          // Send AI response back to WhatsApp
          if (result.response) {
            await sendWhatsAppMessage(remoteJid, result.response);
          }

          // Log the exchange
          await db.agentLog.create({
            data: {
              agentId: "whatsapp-inbound",
              input: { content: text, messageId },
              output: { response: result.response, agent: result.agentUsed },
            },
          });
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
