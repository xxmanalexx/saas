import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
  }

  const agents = await db.agent.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ agents });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { workspaceId, name, type, config } = body;

  if (!workspaceId || !name || !type) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const agent = await db.agent.create({
    data: { workspaceId, name, type, config: config ?? {} },
  });

  return NextResponse.json({ agent });
}
