/**
 * GET /api/settings
 * PATCH /api/settings
 * Get and update workspace settings, Ollama config, database config, and persona.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { clearOllamaCache } from "@/lib/ollamaConfig";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      settings: true,
      ollamaUrl: true,
      ollamaModel: true,
      databaseUrl: true,
      personas: {
        where: { isDefault: true },
        take: 1,
      },
    },
  });

  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  return NextResponse.json({
    id: workspace.id,
    name: workspace.name,
    settings: workspace.settings,
    ollamaUrl: workspace.ollamaUrl,
    ollamaModel: workspace.ollamaModel,
    databaseUrl: workspace.databaseUrl ?? "",
    defaultPersona: workspace.personas[0] ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, settings, ollamaUrl, ollamaModel, databaseUrl } = body;

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const updated = await db.workspace.update({
    where: { id: workspace.id },
    data: {
      ...(name !== undefined && { name }),
      ...(settings !== undefined && { settings }),
      ...(ollamaUrl !== undefined && { ollamaUrl }),
      ...(ollamaModel !== undefined && { ollamaModel }),
      ...(databaseUrl !== undefined && { databaseUrl }),
    },
    select: {
      id: true,
      name: true,
      settings: true,
      ollamaUrl: true,
      ollamaModel: true,
      databaseUrl: true,
    },
  });

  // Clear cached Ollama config so changes take effect immediately
  clearOllamaCache(workspace.id);

  return NextResponse.json(updated);
}
