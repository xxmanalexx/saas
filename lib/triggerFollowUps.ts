import { runFollowUpJob } from "@/agents/FollowUpAgent";

/**
 * Fire-and-forget background task.
 * Checks all workspaces for stale conversations and sends follow-ups.
 * Call this after any message is processed (AI response sent, etc.)
 * No await — runs in background without blocking the response.
 */
export function triggerFollowUps(workspaceId: string): void {
  // Fire and forget — don't await
  setImmediate(() => {
    runFollowUpJob(workspaceId)
      .then((results) => {
        if (results.length > 0) {
          console.log(`[FollowUp] workspace ${workspaceId}: sent ${results.length} follow-up(s)`);
        }
      })
      .catch((err) => {
        console.error(`[FollowUp] workspace ${workspaceId} error:`, err);
      });
  });
}
