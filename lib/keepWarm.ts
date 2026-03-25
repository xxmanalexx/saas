/**
 * Lightweight ping to keep the Ollama model loaded in memory.
 * Scheduled to run every 30 seconds — prevents cold-start delay on first
 * WhatsApp message after idle periods.
 *
 * Run via: cron job with sessionTarget="isolated", payload.kind="agentTurn"
 */
export async function keepOllamaWarm(workspaceUrl: string): Promise<void> {
  try {
    await fetch(`${workspaceUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Silently ignore — next message will wake Ollama naturally
  }
}
