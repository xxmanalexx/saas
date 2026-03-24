/**
 * GET /api/conversations
 * DELETE /api/conversations/[id]
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json([]);

  const conversations = await db.conversation.findMany({
    where: { workspaceId: workspace.id },
    include: {
      contact: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return NextResponse.json(conversations);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pathname } = req.nextUrl;
  const id = pathname.split("/").pop();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const conversation = await db.conversation.findUnique({ where: { id } });
  if (!conversation || conversation.workspaceId !== workspace.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.conversation.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
