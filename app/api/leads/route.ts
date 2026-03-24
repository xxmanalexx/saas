import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
  }

  const leads = await db.lead.findMany({
    where: { workspaceId },
    include: { contact: true, events: { orderBy: { createdAt: "desc" }, take: 5 } },
    orderBy: { score: "desc" },
    take: 100,
  });

  return NextResponse.json({ leads });
}
