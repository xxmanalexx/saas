import { NextRequest, NextResponse } from "next/server";
import { processMessage } from "@/lib/conversationEngine";

// POST /api/webhooks/whatsapp — receive WhatsApp incoming messages
export async function POST(req: NextRequest) {
  const body = await req.json();

  // Verify Meta webhook (challenge response for webhook setup)
  if (req.nextUrl.searchParams.get("hub.mode") === "subscribe") {
    const challenge = req.nextUrl.searchParams.get("hub.challenge");
    const token = req.nextUrl.searchParams.get("hub.verify_token");
    if (token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return new NextResponse(challenge, { status: 200 });
    }
    return NextResponse.json({ error: "Invalid verify token" }, { status: 403 });
  }

  // Parse incoming WhatsApp message
  const entry = body.entry?.[0];
  const change = entry?.changes?.[0];
  const message = change?.value?.messages?.[0];
  const contact = change?.value?.contacts?.[0];

  if (!message || !contact) {
    return NextResponse.json({ error: "No message found" }, { status: 400 });
  }

  const workspaceId = req.headers.get("x-workspace-id");
  if (!workspaceId) {
    return NextResponse.json({ error: "Missing x-workspace-id header" }, { status: 400 });
  }

  const result = await processMessage({
    workspaceId,
    channel: "WHATSAPP",
    channelId: message.id,
    contactIdentifier: message.from,
    contactProfile: { name: contact.profile?.name ?? "Unknown" },
    content: message.text?.body ?? "",
  });

  // Send response back via WhatsApp API
  const { WhatsAppAdapter } = await import("@/channels/whatsapp");
  const adapter = new WhatsAppAdapter(
    process.env.WHATSAPP_ACCESS_TOKEN!,
    process.env.WHATSAPP_PHONE_NUMBER_ID!
  );

  await adapter.sendText(message.from, result.response);

  return NextResponse.json({ ok: true, result });
}
