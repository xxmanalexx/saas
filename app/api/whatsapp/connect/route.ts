import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSocket, getConnectionStatus } from "@/lib/whatsappBaileys";
import { processMessage } from "@/lib/conversationEngine";

// POST /api/whatsapp/connect
// Starts the WhatsApp Baileys socket (QR code will be available at /status or /qr)
export async function POST(req: NextRequest) {
  const workspaceId = req.headers.get("x-workspace-id") ?? "default";

  // Check if already connected
  const existing = getConnectionStatus();
  if (existing.status === "connected") {
    return NextResponse.json({ ok: true, status: existing, message: "Already connected" });
  }

  // Start the socket — QR callback fires and is stored in memory
  try {
    const socket = await getOrCreateSocket(workspaceId, (qr) => {
      // QR received — store it (client will poll /qr or /status)
      console.log(`[WhatsApp] New QR generated for workspace ${workspaceId}`);
    });

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
