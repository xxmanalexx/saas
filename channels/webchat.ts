// Web Chat adapter — handles the embedded widget on customer websites
// Customer embeds: <script src="https://yourapp.com/widget.js" data-workspace="workspace_id"></script>

import { db } from "@/lib/db";

export interface WebChatMessage {
  id: string;
  sessionId: string;
  workspaceId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface WebChatSession {
  id: string;
  workspaceId: string;
  contactIdentifier: string;
  profile: Record<string, string>;
  createdAt: Date;
  status: "ACTIVE" | "CLOSED";
}

// In-memory store for web chat sessions (scales to Redis later)
const sessions = new Map<string, WebChatSession>();

export async function createWebChatSession(
  workspaceId: string,
  identifier: string,
  profile: Record<string, string>
): Promise<WebChatSession> {
  const existing = Array.from(sessions.values()).find(
    (s) => s.workspaceId === workspaceId && s.contactIdentifier === identifier
  );
  if (existing) return existing;

  const session: WebChatSession = {
    id: `wcs_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    workspaceId,
    contactIdentifier: identifier,
    profile,
    createdAt: new Date(),
    status: "ACTIVE",
  };
  sessions.set(session.id, session);
  return session;
}

export async function getWebChatSession(sessionId: string): Promise<WebChatSession | null> {
  return sessions.get(sessionId) ?? null;
}

export async function closeWebChatSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (session) {
    session.status = "CLOSED";
    sessions.set(sessionId, session);
  }
}

export async function getOrCreateContact(
  workspaceId: string,
  identifier: string,
  profile: Record<string, string>
) {
  const contact = await db.contact.upsert({
    where: {
      workspaceId_channel_channelIdentifier: {
        workspaceId,
        channel: "WEB_CHAT",
        channelIdentifier: identifier,
      },
    },
    update: { profile },
    create: {
      workspaceId,
      channel: "WEB_CHAT",
      channelIdentifier: identifier,
      profile,
    },
  });
  return contact;
}
