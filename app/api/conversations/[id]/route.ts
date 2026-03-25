/**
 * DELETE /api/conversations/[id]
 * Delete a single conversation and all its messages + transcript.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!workspace) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const conversation = await db.conversation.findUnique({ where: { id } });
  if (!conversation || conversation.workspaceId !== workspace.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete messages and transcript first, then conversation
  await db.message.deleteMany({ where: { conversationId: id } });
  await db.transcript.deleteMany({ where: { conversationId: id } });
  await db.conversation.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

/**
 * PATCH /api/conversations/[id]
 * Clear all messages from a conversation (reset the chat history).
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!workspace) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const conversation = await db.conversation.findUnique({ where: { id } });
  if (!conversation || conversation.workspaceId !== workspace.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.message.deleteMany({ where: { conversationId: id } });
  await db.transcript.deleteMany({ where: { conversationId: id } });
  await db.conversation.update({ where: { id }, data: { status: "ACTIVE" } });

  return NextResponse.json({ success: true });
}
