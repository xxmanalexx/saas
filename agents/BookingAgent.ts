import { aiComplete, type AiMessage, type AiOptions } from "@/lib/ai";
import { db } from "@/lib/db";
import type { Contact, Conversation } from "@prisma/client";
import { aiCompleteSimple } from "@/lib/ai";

export interface BookingResult {
  confirmed: boolean;
  slot?: {
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    durationMinutes: number;
  };
  calendarEventId?: string;
  response: string;
}

interface BookingConfig {
  businessName: string;
  timezone: string;
  defaultDurationMinutes: number;
  workingHours: { start: string; end: string }; // "09:00", "17:00"
  bufferMinutes: number; // gap between bookings
}

const DEFAULT_BOOKING_CONFIG: BookingConfig = {
  businessName: "Rana AI",
  timezone: "Asia/Muscat",
  defaultDurationMinutes: 30,
  workingHours: { start: "09:00", end: "17:00" },
  bufferMinutes: 15,
};

export async function bookingAgent(
  workspaceId: string,
  contact: Contact,
  conversation: Conversation,
  incomingMessage: string,
  history: AiMessage[],
  aiOpts?: AiOptions,
  knowledgeContext?: string,
  personaContext?: string,
  config?: Partial<BookingConfig>
): Promise<BookingResult & { response: string }> {
  const cfg = { ...DEFAULT_BOOKING_CONFIG, ...config };

  // Check for Cal.com integration
  const calIntegration = await db.integration.findFirst({
    where: { workspaceId, channel: "WHATSAPP" }, // placeholder — real channel check
  });

  // Detect intent: check availability vs. confirm booking
  const lowerMsg = incomingMessage.toLowerCase();
  const intents = {
    checkSlots: /availability|available|times?|when (is|are)|schedule/i.test(lowerMsg),
    proposeSlot: /how about|what about|does.*work|book|confirm|yes|sounds good/i.test(lowerMsg),
    cancel: /cancel|reschedule|change/i.test(lowerMsg),
  };

  if (intents.cancel) {
    return {
      confirmed: false,
      response: "Sure, I can help you reschedule or cancel. Just let me know what you'd prefer.",
    };
  }

  if (intents.checkSlots) {
    const slots = await getAvailableSlots(cfg);
    const slotList = slots
      .slice(0, 5)
      .map((s) => `• ${s.date} at ${s.time}`)
      .join("\n");

    return {
      confirmed: false,
      response: `Here are some available times:\n${slotList}\n\nWhich works best for you?`,
    };
  }

  if (intents.proposeSlot) {
    // Extract date/time from message (simplified — real impl uses NER)
    const dateMatch = incomingMessage.match(
      /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|tomorrow|today|next (monday|tuesday|wednessday|thursday|friday|saturday|sunday))\b/i
    );
    const timeMatch = incomingMessage.match(/\b(\d{1,2}:\d{2})\b/i);

    if (dateMatch && timeMatch) {
      const slot = {
        date: dateMatch[1],
        time: timeMatch[1],
        durationMinutes: cfg.defaultDurationMinutes,
      };
      const response = `Perfect — ${slot.date} at ${slot.time}? Let me confirm that... \n\n✅ Booked: ${slot.date} at ${slot.time} (${cfg.defaultDurationMinutes} min)\n\nYou'll receive a confirmation shortly. Anything else I can help with?`;

      return {
        confirmed: true,
        slot,
        response,
      };
    }

    // No clear date/time found — ask
    return {
      confirmed: false,
      response: `I'd love to set that up! What date and time works best for you?`,
    };
  }

  // Default: ask for preference
  return {
    confirmed: false,
    response: `Of course! Are you looking to book a call? If so, what times work best for you and how long should we set aside?`,
  };
}

async function getAvailableSlots(
  config: BookingConfig
): Promise<Array<{ date: string; time: string }>> {
  // TODO: integrate with Cal.com API
  // For now: return mock slots for the next 3 days
  const slots: Array<{ date: string; time: string }> = [];
  const now = new Date();

  for (let day = 1; day <= 3; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().split("T")[0];

    for (const hour of [9, 10, 11, 14, 15, 16]) {
      slots.push({
        date: dateStr,
        time: `${hour.toString().padStart(2, "0")}:00`,
      });
    }
  }

  return slots;
}
