/**
 * In-memory cache for workspace-level Ollama config.
 * Refreshes from DB every 5 minutes per workspace.
 * This lets us avoid a DB round-trip on every AI call.
 */
import { db } from "@/lib/db";

interface OllamaConfig {
  ollamaUrl: string;
  ollamaModel: string;
  ollamaThinking: boolean;
  databaseUrl?: string;
}

const cache = new Map<string, { config: OllamaConfig; expiresAt: number }>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getOllamaConfig(workspaceId: string): Promise<OllamaConfig> {
  const cached = cache.get(workspaceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.config;
  }

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { ollamaUrl: true, ollamaModel: true, ollamaThinking: true, databaseUrl: true },
  }) as Record<string, unknown> | null;

  const config: OllamaConfig = {
    ollamaUrl: (workspace?.ollamaUrl as string | undefined) ?? "http://localhost:11434",
    ollamaModel: (workspace?.ollamaModel as string | undefined) ?? "qwen3.5:2b",
    ollamaThinking: (workspace?.ollamaThinking as boolean | undefined) ?? true,
    databaseUrl: workspace?.databaseUrl as string | undefined,
  };

  cache.set(workspaceId, { config, expiresAt: Date.now() + TTL_MS });
  return config;
}

export function clearOllamaCache(workspaceId: string): void {
  cache.delete(workspaceId);
}

export function getOllamaConfigSync(workspaceId: string): OllamaConfig | null {
  const cached = cache.get(workspaceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.config;
  }
  return null;
}
