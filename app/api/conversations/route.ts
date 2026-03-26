/**
 * GET /api/conversations
 */
import { NextResponse } from "next/server";
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
      // Fetch last 50 messages for the modal preview
      messages: { orderBy: { createdAt: "desc" }, take: 50 },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return NextResponse.json(conversations);
}
