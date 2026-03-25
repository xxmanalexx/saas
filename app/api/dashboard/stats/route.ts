import { NextResponse } from "next/server";
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

  const [totalConversations, totalLeads, qualifiedLeads, recentLogs] = await Promise.all([
    db.conversation.count({ where: { workspaceId: workspace.id } }),
    db.lead.count({ where: { workspaceId: workspace.id } }),
    db.lead.count({ where: { workspaceId: workspace.id, stage: "QUALIFIED" } }),
    db.agentLog.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  // Avg response time from agent logs (latencyMs field in metadata)
  const latencies = recentLogs
    .map((l) => (l.output as Record<string, unknown>)?.latencyMs as number | null)
    .filter((v): v is number => v != null && v > 0);
  const avgResponseMs = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null;

  return NextResponse.json({
    totalConversations,
    totalLeads,
    qualifiedLeads,
    avgResponseMs,
  });
}
