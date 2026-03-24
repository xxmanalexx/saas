// WhatsApp (Meta Business API) adapter
// Docs: https://developers.facebook.com/docs/whatsapp

export interface WhatsAppMessage {
  messaging_product: "whatsapp";
  to: string;
  type: "text" | "template";
  text?: { body: string };
  template?: {
    name: string;
    language: { code: string };
    components?: Array<{
      type: string;
      sub_type?: string;
      index?: number;
      parameters?: Array<{ type: string; text: string }>;
    }>;
  };
}

export interface WhatsAppIncoming {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: "whatsapp";
        metadata: { phone_number_id: string; display_phone_number: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
        }>;
      };
    }>;
  }>;
}

export class WhatsAppAdapter {
  private accessToken: string;
  private phoneNumberId: string;
  private apiBase = "https://graph.facebook.com/v19.0";

  constructor(accessToken: string, phoneNumberId: string) {
    this.accessToken = accessToken;
    this.phoneNumberId = phoneNumberId;
  }

  async send(message: WhatsAppMessage): Promise<{ success: boolean; messageId?: string }> {
    const url = `${this.apiBase}/${this.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const data = await res.json();
    return {
      success: res.ok,
      messageId: data.messages?.[0]?.id,
    };
  }

  async sendText(to: string, text: string): Promise<{ success: boolean; messageId?: string }> {
    return this.send({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    });
  }

  parseIncoming(payload: WhatsAppIncoming) {
    const change = payload.entry?.[0]?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    const contact = change?.contacts?.[0];

    if (!message) return null;

    return {
      from: message.from,
      id: message.id,
      timestamp: message.timestamp,
      body: message.text?.body ?? "",
      profile: contact?.profile?.name ?? "Unknown",
      waId: contact?.wa_id ?? message.from,
    };
  }
}
