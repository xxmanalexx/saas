import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runFollowUpJob } from "@/agents/FollowUpAgent";

/**
 * Called by the keep-ollama-warm cron every 30 minutes.
 * Iterates all workspaces with follow-up enabled and sends follow-up messages
 * to conversations that have been idle past their configured delay.
 */
export async function GET() {
  const workspaces = await db.workspace.findMany({
    where: { followUpEnabled: true },
    select: { id: true },
  });

  let totalSent = 0;
  for (const ws of workspaces) {
    try {
      const results = await runFollowUpJob(ws.id);
      totalSent += results.length;
    } catch (err) {
      console.error(`[FollowUp] workspace ${ws.id} error:`, err);
    }
  }

  return NextResponse.json({
    workspacesProcessed: workspaces.length,
    messagesSent: totalSent,
  });
}
