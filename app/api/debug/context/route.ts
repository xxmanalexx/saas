/**
 * GET /api/debug/context?workspaceId=xxx
 * Returns the full AI context that would be injected into every message:
 * Ollama config + knowledge base entries + active persona.
 * Use this to verify KB and persona are loaded correctly.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getOllamaConfig } from "@/lib/ollamaConfig";

export async function GET(req: NextRequest) {
  const session = await auth();
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");

  if (!session?.user?.id && !workspaceId) {
    return NextResponse.json({ error: "Provide workspaceId or be logged in" }, { status: 401 });
  }

  // Resolve workspace
  let resolvedWorkspaceId: string | null = workspaceId ?? null;
  if (!resolvedWorkspaceId) {
    const ws = await db.workspace.findFirst({
      where: { userId: session!.user.id },
      select: { id: true },
    });
    resolvedWorkspaceId = ws?.id ?? null;
  }
  if (!resolvedWorkspaceId) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const [ollamaCfg, kbEntries, personas] = await Promise.all([
    getOllamaConfig(resolvedWorkspaceId),
    db.knowledgeBase.findMany({
      where: { workspaceId: resolvedWorkspaceId, isActive: true },
      orderBy: { createdAt: "desc" },
    }),
    db.agentPersona.findMany({
      where: { workspaceId: resolvedWorkspaceId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const defaultPersona = personas.find((p) => p.isDefault) ?? personas[0] ?? null;

  // Build the exact context strings that get injected
  const knowledgeContext = kbEntries.length > 0
    ? "\n\n--- BUSINESS KNOWLEDGE BASE ---\n" +
      kbEntries.map((e) => `[${e.category.toUpperCase()}] ${e.title}\n${e.content}`).join("\n\n") +
      "\n--- END KNOWLEDGE BASE ---"
    : "";

  const personaContext = defaultPersona
    ? `\n\n--- AGENT PERSONA ---\n` +
      `Name: ${defaultPersona.name}\n` +
      `Role: ${defaultPersona.role}\n` +
      `Tone: ${defaultPersona.tone}\n` +
      `Language: ${defaultPersona.language}\n` +
      `Emoji style: ${defaultPersona.emojiStyle}\n` +
      (defaultPersona.instructions ? `Custom instructions: ${defaultPersona.instructions}\n` : "") +
      `--- END PERSONA ---`
    : "";

  return NextResponse.json({
    workspaceId: resolvedWorkspaceId,
    ollama: ollamaCfg,
    knowledgeBase: {
      count: kbEntries.length,
      entries: kbEntries,
      contextString: knowledgeContext,
    },
    persona: {
      count: personas.length,
      default: defaultPersona,
      contextString: personaContext,
    },
    ready: kbEntries.length > 0 || defaultPersona !== null,
  });
}
