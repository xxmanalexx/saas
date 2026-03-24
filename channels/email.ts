// Email adapter using Resend (resend.com)

export interface EmailMessage {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export class EmailAdapter {
  private apiKey: string;
  private fromAddress: string;
  private apiBase = "https://api.resend.com/emails";

  constructor(apiKey: string, fromAddress: string) {
    this.apiKey = apiKey;
    this.fromAddress = fromAddress;
  }

  async send(message: EmailMessage): Promise<{ success: boolean; id?: string; error?: string }> {
    const res = await fetch(this.apiBase, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: message.from ?? this.fromAddress,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    const data = await res.json();
    return res.ok
      ? { success: true, id: data.id }
      : { success: false, error: data.message ?? "Unknown error" };
  }

  async sendText(to: string, subject: string, text: string): Promise<{ success: boolean; id?: string }> {
    const result = await this.send({ to, subject, text });
    return { success: result.success, id: result.id };
  }

  async sendTemplate(
    to: string,
    template: {
      name: string;
      data: Record<string, string>;
    }
  ): Promise<{ success: boolean; id?: string }> {
    // TODO: implement Resend template rendering
    return this.sendText(to, `Rana: ${template.name}`, JSON.stringify(template.data));
  }
}

// Parse incoming email webhooks (from Resend)
export function parseEmailWebhook(payload: {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{ filename: string; url: string }>;
}) {
  return {
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    body: payload.text ?? "",
    htmlBody: payload.html,
    attachments: payload.attachments ?? [],
  };
}
