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
      ollamaThinking: true,
      databaseUrl: true,
      followUpEnabled: true,
      followUpDelayMinutes: true,
      followUpInstructions: true,
      followUpMessage: true,
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
    ollamaThinking: workspace.ollamaThinking,
    databaseUrl: workspace.databaseUrl ?? "",
    followUpEnabled: workspace.followUpEnabled,
    followUpDelayMinutes: workspace.followUpDelayMinutes,
    followUpInstructions: workspace.followUpInstructions,
    followUpMessage: workspace.followUpMessage,
    defaultPersona: workspace.personas[0] ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, settings, ollamaUrl, ollamaModel, ollamaThinking, databaseUrl, followUpEnabled, followUpDelayMinutes, followUpInstructions, followUpMessage } = body;

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
      ...(ollamaThinking !== undefined && { ollamaThinking }),
      ...(databaseUrl !== undefined && { databaseUrl }),
      ...(followUpEnabled !== undefined && { followUpEnabled }),
      ...(followUpDelayMinutes !== undefined && { followUpDelayMinutes }),
      ...(followUpInstructions !== undefined && { followUpInstructions }),
      ...(followUpMessage !== undefined && { followUpMessage }),
    },
    select: {
      id: true,
      name: true,
      settings: true,
      ollamaUrl: true,
      ollamaModel: true,
      ollamaThinking: true,
      databaseUrl: true,
      followUpEnabled: true,
      followUpDelayMinutes: true,
      followUpInstructions: true,
      followUpMessage: true,
    },
  });

  // Clear cached Ollama config so changes take effect immediately
  clearOllamaCache(workspace.id);

  return NextResponse.json(updated);
}
