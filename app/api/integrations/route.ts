import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json();
  const { workspaceId, channel, credentials, settings } = body;

  if (!workspaceId || !channel) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const integration = await db.integration.upsert({
    where: {
      workspaceId_channel: { workspaceId, channel },
    },
    update: { credentials, settings, status: "CONNECTED" },
    create: {
      workspaceId,
      channel,
      credentials,
      settings,
      status: "CONNECTED",
    },
  });

  return NextResponse.json({ integration });
}
