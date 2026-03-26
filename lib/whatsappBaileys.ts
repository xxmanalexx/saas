/**
 * WhatsApp Baileys Manager
 * Singleton WASocket — QR scan, message handling, stays connected outside Next.js.
 * Auth state persisted to /tmp/baileys_auth/<workspaceId>
 */

import makeWASocket, {
  type WASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "baileys";
import type { BaileysEventMap, ConnectionState } from "baileys";
import qrcode from "qrcode";
import pino from "pino";
import { mkdirSync, existsSync, rmSync } from "fs";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QRCodeData {
  qr: string; // data URL (PNG base64)
  generatedAt: number;
}

export interface WhatsAppIncomingMessage {
  remoteJid: string;
  fromMe: boolean;
  messageId: string;
  text: string;
  pushName: string | null;
  timestamp: number;
  audioBuffer?: Buffer;
  mimeType?: string;
  hasAudio?: boolean;
}

// ─── In-memory state (survives hot reload within same process) ─────────────────

let socket: WASocket | null = null;
let qrCallback: ((qr: QRCodeData) => void) | null = null;
let currentQR: QRCodeData | null = null;
let connStatus: "disconnected" | "connecting" | "connected" | "error" = "disconnected";
let statusMessage = "Not connected";
let messageHandler: ((msg: WhatsAppIncomingMessage) => void) | null = null;

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function getAuthDir(workspaceId: string): string {
  return `/tmp/baileys_auth/${workspaceId}`;
}

async function getAuthState(workspaceId: string) {
  const dir = getAuthDir(workspaceId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return useMultiFileAuthState(dir);
}

// ─── Extract text from a WAMessage ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(msg: any): string {
  if (!msg) return "";
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    msg.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
    // Voice notes (ptt = push-to-talk)
    (msg.ptvMessage ? "[🎤 صوتية]" : "") ||
    ""
  );
}

// ─── Create or reuse socket ───────────────────────────────────────────────────

export async function getOrCreateSocket(
  workspaceId: string,
  onQR: (qr: QRCodeData) => void,
  onMessage?: (msg: WhatsAppIncomingMessage) => void
): Promise<WASocket> {
  // Already connected — reuse
  if (socket && connStatus === "connected") {
    return socket;
  }

  qrCallback = onQR;
  messageHandler = onMessage ?? null;
  connStatus = "connecting";
  statusMessage = "Starting WhatsApp...";

  const { state, saveCreds } = await getAuthState(workspaceId);
  const { version } = await fetchLatestBaileysVersion();

  const logger = pino({ level: "silent" as const });

  socket = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys) },
    logger,
    printQRInTerminal: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getMessage: async () => ({ conversation: "placeholder" } as any),
  });

  // ── QR code received ────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (socket.ev as any).on("qr", async (qr: string) => {
    try {
      const dataUrl = await qrcode.toDataURL(qr, { margin: 2, scale: 4 });
      currentQR = { qr: dataUrl, generatedAt: Date.now() };
      qrCallback?.(currentQR);
    } catch (err) {
      console.error("[WhatsApp] QR encode error:", err);
    }
  });

  // ── Connection state ────────────────────────────────────────────────────
  socket.ev.on("connection.update", (update: Partial<ConnectionState>) => {
    const { connection, qr } = update;

    if (connection === "open") {
      connStatus = "connected";
      statusMessage = "Connected ✓";
      currentQR = null;
    } else if (connection === "close") {
      const err = update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined;
      const statusCode = err?.output?.statusCode;
      if (statusCode === 401) {
        connStatus = "disconnected";
        statusMessage = "Session expired — please re-scan QR";
        socket = null;
        currentQR = null;
      } else {
        connStatus = "connecting";
        statusMessage = "Reconnecting...";
      }
    }

    // If a new QR arrives via connection.update (some versions emit here)
    if (qr) {
      qrcode.toDataURL(qr, { margin: 2, scale: 4 }).then((dataUrl) => {
        currentQR = { qr: dataUrl, generatedAt: Date.now() };
        qrCallback?.(currentQR);
      }).catch(() => {});
    }
  });

  // ── Credentials persisted ────────────────────────────────────────────────
  socket.ev.on("creds.update", saveCreds);

  // ── Incoming messages ───────────────────────────────────────────────────
  socket.ev.on("messages.upsert", ({ messages }: BaileysEventMap["messages.upsert"]) => {
    for (const msg of messages) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = msg as any;

      const rawJid = m.key?.remoteJid ?? "";
      const rawText = extractText(m.message);
      const msgTypes = Object.keys(m.message ?? {}).join(",");
      console.log(`[Baileys] msg upsert | jid="${rawJid}" | text="${rawText}" | types="${msgTypes}" | fromMe=${m.key?.fromMe}`);

      if (m.key?.fromMe) continue;
      // Reject status broadcasts, newsletters, and group messages early — before any processing
      const isGroup = rawJid.includes("@g.us");
      const isNewsletter = rawJid.includes("@newsletter");
      const isStatus = rawJid.endsWith("@status.broadcast");
      if (isGroup || isNewsletter || isStatus) {
        console.log(`[Baileys] BLOCKED ${isStatus ? "status broadcast" : isNewsletter ? "newsletter" : "group"}: ${rawJid}`);
        continue;
      }
      if (!rawText && !m.message?.imageMessage && !m.message?.videoMessage && !m.message?.audioMessage) continue;

      const audioMessage = m.message?.audioMessage;
      const audioBuffer = audioMessage?.url ? Buffer.from(audioMessage.url, "base64") : null;
      const mimeType = audioMessage?.mimetype ?? "audio/ogg";

      const incoming: WhatsAppIncomingMessage = {
        remoteJid: rawJid,
        fromMe: Boolean(m.key?.fromMe),
        messageId: m.key?.id ?? "",
        text: rawText,
        pushName: m.pushName ?? null,
        timestamp: Number(m.messageTimestamp ?? 0),
        audioBuffer: audioBuffer ?? undefined,
        mimeType,
        hasAudio: Boolean(audioMessage),
      };

      if (messageHandler) {
        messageHandler(incoming);
      }
    }
  });

  return socket;
}

// ─── Send a message ─────────────────────────────────────────────────────────

export async function sendWhatsAppMessage(
  jid: string,
  text: string
): Promise<{ success: boolean; key?: unknown }> {
  if (!socket || connStatus !== "connected") return { success: false };
  try {
    const key = await socket.sendMessage(jid, { text });
    return { success: true, key };
  } catch (err) {
    console.error("[WhatsApp] send error:", err);
    return { success: false };
  }
}

// ─── Send typing indicator ────────────────────────────────────────────────────

export async function sendTypingIndicator(
  jid: string,
  typing: boolean
): Promise<void> {
  if (!socket || connStatus !== "connected") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await socket.sendPresenceUpdate(typing ? "composing" : "paused", jid as any);
  } catch (err) {
    console.error("[WhatsApp] presence update error:", err);
  }
}

// ─── Status ─────────────────────────────────────────────────────────────────

export function getConnectionStatus() {
  return {
    status: connStatus,
    message: statusMessage,
    hasQR: currentQR !== null,
    qrGeneratedAt: currentQR?.generatedAt ?? null,
    qr: currentQR?.qr ?? null,
  };
}

// ─── Disconnect ─────────────────────────────────────────────────────────────

export async function disconnectSocket(workspaceId: string): Promise<void> {
  if (socket) {
    try { await socket.logout(); } catch (_) {}
    socket = null;
  }
  currentQR = null;
  qrCallback = null;
  connStatus = "disconnected";
  statusMessage = "Disconnected";
  try {
    rmSync(getAuthDir(workspaceId), { recursive: true, force: true });
  } catch (_) {}
}

// ─── Get current QR (for polling endpoint) ─────────────────────────────────

export function getCurrentQR(): QRCodeData | null {
  return currentQR;
}
