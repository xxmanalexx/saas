import { NextRequest, NextResponse } from "next/server";
import { processMessage } from "@/lib/conversationEngine";

// POST /api/webhooks/webchat — receive web chat messages
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sessionId, workspaceId, message, profile } = body;

  if (!sessionId || !workspaceId || !message) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const result = await processMessage({
    workspaceId,
    channel: "WEB_CHAT",
    channelId: sessionId,
    contactIdentifier: sessionId,
    contactProfile: profile ?? {},
    content: message,
  });

  return NextResponse.json({ ok: true, response: result.response });
}
