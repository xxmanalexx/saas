/**
 * GET/POST /api/personas
 * List and create agent personas.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const personas = await db.agentPersona.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(personas);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, name, role, tone, language, emojiStyle, instructions, isDefault } = body;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Verify this persona belongs to the user's workspace
  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const existing = await db.agentPersona.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing) return NextResponse.json({ error: "Persona not found" }, { status: 404 });

  // If setting as default, unset others first
  if (isDefault) {
    await db.agentPersona.updateMany({
      where: { workspaceId: workspace.id, isDefault: true },
      data: { isDefault: false },
    });
  }

  const updated = await db.agentPersona.update({
    where: { id },
    data: {
      name,
      role: role ?? existing.role,
      tone: tone ?? existing.tone,
      language: language ?? existing.language,
      emojiStyle: emojiStyle ?? existing.emojiStyle,
      instructions: instructions ?? existing.instructions,
      isDefault: isDefault ?? existing.isDefault,
    },
  });

  return NextResponse.json(updated);
}
