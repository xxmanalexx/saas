import { aiCompleteSimple } from "@/lib/ai";
import { db } from "@/lib/db";
import type { Lead, Contact } from "@prisma/client";

export interface FollowUpResult {
  sent: boolean;
  channel: string;
  response: string;
}

interface FollowUpConfig {
  coldLeadDays: number; // follow up after N days of silence
  maxFollowUps: number;
  messageTemplates: {
    first: string;
    second: string;
    last: string;
  };
}

const DEFAULT_TEMPLATES = {
  first: "Hi {{name}}! Just checking in — did you have any questions about Rana? Happy to help if you're ready to get started.",
  second: "Hi {{name}}! Just a gentle reminder we're here if you need anything. Feel free to reply anytime or book a call: [link]",
  last: "Hi {{name}} — I don't want to overdo it! If you're not ready yet, no worries at all. But if you ever want to revisit Rana, we'll be here. 😊",
};

export async function followUpAgent(
  workspaceId: string,
  lead: Lead & { contact: Contact },
  config?: Partial<FollowUpConfig>
): Promise<FollowUpResult> {
  const cfg: FollowUpConfig = {
    coldLeadDays: config?.coldLeadDays ?? 3,
    maxFollowUps: config?.maxFollowUps ?? 3,
    messageTemplates: { ...DEFAULT_TEMPLATES, ...config?.messageTemplates },
  };

  const lastEvent = await db.leadEvent.findFirst({
    where: { leadId: lead.id },
    orderBy: { createdAt: "desc" },
  });

  const daysSinceLastContact = lastEvent
    ? Math.floor(
        (Date.now() - new Date(lastEvent.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      )
    : 999;

  if (daysSinceLastContact < cfg.coldLeadDays) {
    return { sent: false, channel: "none", response: "Too soon to follow up" };
  }

  // Determine which follow-up this is
  const followUpCount = await db.leadEvent.count({
    where: { leadId: lead.id, type: "follow_up_sent" },
  });

  let template: string;
  if (followUpCount === 0) template = cfg.messageTemplates.first;
  else if (followUpCount < cfg.maxFollowUps - 1) template = cfg.messageTemplates.second;
  else template = cfg.messageTemplates.last;

  const contactName =
    (lead.contact.profile as Record<string, string>)?.name ?? "there";
  const message = template.replace("{{name}}", contactName);

  // Log the follow-up
  await db.leadEvent.create({
    data: {
      leadId: lead.id,
      type: "follow_up_sent",
      data: {
        message,
        followUpNumber: followUpCount + 1,
        channel: lead.contact.channel,
      },
    },
  });

  // In production: actually send via WhatsApp/IG/email here
  // For now: log and return
  console.log(`[FollowUpAgent] Would send to ${lead.contact.channelIdentifier}: ${message}`);

  return {
    sent: true,
    channel: lead.contact.channel,
    response: message,
  };
}
