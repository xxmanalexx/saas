import { NextRequest, NextResponse } from "next/server";
import { disconnectSocket, getConnectionStatus } from "@/lib/whatsappBaileys";

// POST /api/whatsapp/disconnect
export async function POST(req: NextRequest) {
  const workspaceId = req.headers.get("x-workspace-id") ?? "default";

  await disconnectSocket(workspaceId);

  return NextResponse.json({ ok: true, status: getConnectionStatus() });
}
