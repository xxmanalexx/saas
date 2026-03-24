/**
 * PUT/DELETE /api/knowledge/[id]
 * Update or delete a single knowledge base entry.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { title, content, category, isActive } = body;

  // Verify ownership
  const entry = await db.knowledgeBase.findUnique({ where: { id } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id, id: entry.workspaceId },
  });
  if (!workspace) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await db.knowledgeBase.update({
    where: { id },
    data: { title, content, category, isActive },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const entry = await db.knowledgeBase.findUnique({ where: { id } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id, id: entry.workspaceId },
  });
  if (!workspace) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.knowledgeBase.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
