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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, role, tone, language, emojiStyle, instructions, isDefault } = body;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  // If setting as default, unset others
  if (isDefault) {
    await db.agentPersona.updateMany({
      where: { workspaceId: workspace.id, isDefault: true },
      data: { isDefault: false },
    });
  }

  const persona = await db.agentPersona.create({
    data: {
      workspaceId: workspace.id,
      name,
      role: role ?? "SUPPORT",
      tone: tone ?? "FRIENDLY",
      language: language ?? "en",
      emojiStyle: emojiStyle ?? "SOMETIMES",
      instructions: instructions ?? "",
      isDefault: isDefault ?? false,
    },
  });

  return NextResponse.json(persona, { status: 201 });
}
