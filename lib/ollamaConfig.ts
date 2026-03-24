/**
 * In-memory cache for workspace-level Ollama config.
 * Refreshes from DB every 5 minutes per workspace.
 * This lets us avoid a DB round-trip on every AI call.
 */
import { db } from "@/lib/db";

interface OllamaConfig {
  ollamaUrl: string;
  ollamaModel: string;
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
    select: { ollamaUrl: true, ollamaModel: true },
  });

  const config: OllamaConfig = {
    ollamaUrl: workspace?.ollamaUrl ?? "http://localhost:11434",
    ollamaModel: workspace?.ollamaModel ?? "llama3.2",
  };

  cache.set(workspaceId, { config, expiresAt: Date.now() + TTL_MS });
  return config;
}

export function getOllamaConfigSync(workspaceId: string): OllamaConfig | null {
  const cached = cache.get(workspaceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.config;
  }
  return null;
}
