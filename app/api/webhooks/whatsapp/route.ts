import { NextRequest, NextResponse } from "next/server";
import { processMessage } from "@/lib/conversationEngine";

// POST /api/webhooks/whatsapp — receive WhatsApp incoming messages
export async function POST(req: NextRequest) {
  const body = await req.json();

  // ── 1. Webhook verification (Meta setup challenge) ──────────────────────
  if (req.nextUrl.searchParams.get("hub.mode") === "subscribe") {
    const challenge = req.nextUrl.searchParams.get("hub.challenge");
    const token = req.nextUrl.searchParams.get("hub.verify_token");
    if (token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return new NextResponse(challenge, { status: 200 });
    }
    return NextResponse.json({ error: "Invalid verify token" }, { status: 403 });
  }

  // ── 2. Parse webhook payload ───────────────────────────────────────────────
  const entry = body.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value ?? {};

  // Ignore status updates and broadcast message events — they have no user messages
  if (value.statuses || value.conversation_prediction) {
    return NextResponse.json({ ignored: "status event" });
  }

  // Only process actual user-sent messages
  const message = value.messages?.[0];
  const contact = value.contacts?.[0];

  if (!message || message.id === "false" || !contact) {
    return NextResponse.json({ ignored: "no user message" });
  }

  // Ignore group messages, status broadcasts, ephemeral messages, and privacy-hidden messages
  const msgId: string = message.id ?? "";
  const msgFrom: string = message.from ?? "";
  const isGroup = msgId.includes("@g.us") || msgFrom.includes("@g.us");
  const isBroadcast = msgId.includes("@broadcast") || msgFrom.includes("@broadcast");
  const isEphemeral = message.type === "ephemeral" || message.context?.is_ephemeral;
  // lid = privacy-hidden sender (number replaced with local anonymous ID)
  const isPrivacyHidden = msgFrom.includes("@lid");
  if (isGroup || isBroadcast || isEphemeral || isPrivacyHidden) {
    return NextResponse.json({ ignored: `filtered: ${message.type ?? "unknown"}` });
  }

  // Reject messages with no text content (images, documents, voice notes without caption)
  const text = message.text?.body ?? "";
  const hasMediaContent = message.type !== "text" && !text;
  if (hasMediaContent) {
    return NextResponse.json({ ignored: `media-only message: ${message.type}` });
  }

  const workspaceId = req.headers.get("x-workspace-id");
  if (!workspaceId) {
    return NextResponse.json({ error: "Missing x-workspace-id header" }, { status: 400 });
  }

  // ── 3. Process message ─────────────────────────────────────────────────────
  const result = await processMessage({
    workspaceId,
    channel: "WHATSAPP",
    channelId: message.from,   // phone number — one conversation thread per contact
    contactIdentifier: message.from,
    contactProfile: { name: contact.profile?.name ?? "Unknown" },
    content: message.text?.body ?? "",
  });

  // ── 4. Send AI response back to WhatsApp ──────────────────────────────────
  const { WhatsAppAdapter } = await import("@/channels/whatsapp");
  const adapter = new WhatsAppAdapter(
    process.env.WHATSAPP_ACCESS_TOKEN!,
    process.env.WHATSAPP_PHONE_NUMBER_ID!
  );

  await adapter.sendText(message.from, result.response);

  return NextResponse.json({ ok: true, result });
}
