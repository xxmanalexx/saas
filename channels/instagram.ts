// Instagram DM adapter via Meta Graph API

export interface InstagramIncoming {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    changes: Array<{
      value: {
        from: { id: string; username: string; name: string };
        id: string;
        text?: string;
        media?: { id: string; media_type: string; media_url: string };
        timestamp: string;
      };
    }>;
  }>;
}

export class InstagramAdapter {
  private accessToken: string;
  private apiBase = "https://graph.facebook.com/v19.0";

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async sendText(recipientId: string, text: string): Promise<{ success: boolean }> {
    const res = await fetch(`${this.apiBase}/me/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
      }),
    });
    return { success: res.ok };
  }

  parseIncoming(payload: InstagramIncoming) {
    const change = payload.entry?.[0]?.changes?.[0]?.value;
    if (!change) return null;

    return {
      fromId: change.from.id,
      username: change.from.username,
      name: change.from.name,
      messageId: change.id,
      body: change.text ?? "",
      timestamp: change.timestamp,
    };
  }
}
