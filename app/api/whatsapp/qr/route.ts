import { NextRequest, NextResponse } from "next/server";
import { getCurrentQR } from "@/lib/whatsappBaileys";

// GET /api/whatsapp/qr
// Poll this endpoint to get the current QR code as JSON
export async function GET(req: NextRequest) {
  const workspaceId = req.headers.get("x-workspace-id") ?? "default";
  const qr = getCurrentQR();

  if (!qr) {
    return NextResponse.json({ hasQR: false, workspaceId });
  }

  return NextResponse.json({
    hasQR: true,
    qr: qr.qr,
    generatedAt: qr.generatedAt,
    workspaceId,
  });
}
