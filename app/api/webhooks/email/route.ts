import { NextRequest, NextResponse } from "next/server";
import { processMessage } from "@/lib/conversationEngine";

// POST /api/webhooks/email — receive incoming emails (via Resend or SendGrid webhook)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { from, to, subject, text } = body;

  if (!from || !text) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const workspaceId = req.headers.get("x-workspace-id");
  if (!workspaceId) {
    return NextResponse.json({ error: "Missing x-workspace-id header" }, { status: 400 });
  }

  const result = await processMessage({
    workspaceId,
    channel: "EMAIL",
    channelId: from, // use sender email as channel ID
    contactIdentifier: from,
    contactProfile: { email: from, subject },
    content: text,
  });

  // Send response back via email
  const { EmailAdapter } = await import("@/channels/email");
  const adapter = new EmailAdapter(
    process.env.RESEND_API_KEY!,
    "Rana <noreply@rana.ai>"
  );

  await adapter.sendText(from, `Re: ${subject}`, result.response);

  return NextResponse.json({ ok: true });
}
