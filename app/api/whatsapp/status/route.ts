import { NextRequest, NextResponse } from "next/server";
import {
  getConnectionStatus,
  getCurrentQR,
} from "@/lib/whatsappBaileys";

// GET /api/whatsapp/status
// Returns current connection status and QR code if pending
export async function GET(req: NextRequest) {
  const workspaceId = req.headers.get("x-workspace-id") ?? "default";

  const status = getConnectionStatus();

  return NextResponse.json({
    workspaceId,
    ...status,
  });
}
