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

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // ── Parallel DB reads ─────────────────────────────────────────────────────
  const [
    totalConversations,
    totalLeads,
    stageRows,
    allMessages,
    allConversations,
    allLeads,
    agentLogs,
    leadsQualified,
    leadsWon,
    escalatedCount,
  ] = await Promise.all([
    db.conversation.count({ where: { workspaceId: workspace.id } }),

    db.lead.count({ where: { workspaceId: workspace.id } }),

    // Stage breakdown via groupBy
    db.lead.groupBy({
      by: ["stage"],
      where: { workspaceId: workspace.id },
      _count: { id: true },
    }),

    // All messages in last 30d (for channel + daily breakdown)
    db.message.findMany({
      where: {
        conversation: { workspaceId: workspace.id },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        role: true,
        createdAt: true,
        conversation: { select: { channel: true } },
      },
    }),

    // All conversations started in last 30d
    db.conversation.findMany({
      where: { workspaceId: workspace.id, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),

    // All leads in last 30d
    db.lead.findMany({
      where: { workspaceId: workspace.id, createdAt: { gte: thirtyDaysAgo } },
      select: { stage: true, score: true, createdAt: true },
    }),

    // Agent logs (last 30d)
    db.agentLog.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, output: true },
    }),

    db.lead.count({ where: { workspaceId: workspace.id, stage: "QUALIFIED" } }),
    db.lead.count({ where: { workspaceId: workspace.id, stage: "WON" } }),
    db.conversation.count({ where: { workspaceId: workspace.id, status: "ESCALATED" } }),
  ]);

  // ── Stage breakdown ────────────────────────────────────────────────────────
  const stageMap: Record<string, number> = {};
  for (const row of stageRows) {
    stageMap[row.stage] = row._count.id;
  }

  // ── Messages per channel ──────────────────────────────────────────────────
  const channelMessages: Record<string, number> = {};
  for (const msg of allMessages) {
    const ch = msg.conversation?.channel ?? "OTHER";
    channelMessages[ch] = (channelMessages[ch] ?? 0) + 1;
  }

  // ── Messages per day ──────────────────────────────────────────────────────
  const messagesPerDay: Record<string, number> = {};
  for (const msg of allMessages) {
    const day = msg.createdAt.toISOString().slice(0, 10);
    messagesPerDay[day] = (messagesPerDay[day] ?? 0) + 1;
  }

  // ── Conversations per day ─────────────────────────────────────────────────
  const convsPerDay: Record<string, number> = {};
  for (const conv of allConversations) {
    const day = conv.createdAt.toISOString().slice(0, 10);
    convsPerDay[day] = (convsPerDay[day] ?? 0) + 1;
  }

  // ── Leads per channel ─────────────────────────────────────────────────────
  const channelLeads: Record<string, number> = {};
  const leadsAll = await db.lead.findMany({
    where: { workspaceId: workspace.id },
    select: { contact: { select: { channel: true } } },
  });
  for (const lead of leadsAll) {
    const ch = lead.contact?.channel ?? "OTHER";
    channelLeads[ch] = (channelLeads[ch] ?? 0) + 1;
  }

  // ── Peak hours (last 7 days) ───────────────────────────────────────────────
  const hourCounts: number[] = Array(24).fill(0);
  for (const msg of allMessages) {
    if (msg.createdAt >= sevenDaysAgo) {
      hourCounts[new Date(msg.createdAt).getHours()]++;
    }
  }
  const peakHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // ── Avg response time from logs ──────────────────────────────────────────
  const latencies = agentLogs
    .map((l) => (typeof l.output === "string" ? JSON.parse(l.output) : l.output) as Record<string, unknown>)
    .map((o) => o?.latencyMs as number | null)
    .filter((v): v is number => v != null && v > 0);
  const avgResponseMs = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null;

  // ── Last 7 days summaries ─────────────────────────────────────────────────
  const last7dMessages = allMessages.filter((m) => m.createdAt >= sevenDaysAgo).length;
  const last7dConversations = allConversations.filter((c) => c.createdAt >= sevenDaysAgo).length;
  const last7dLeads = allLeads.filter((l) => l.createdAt >= sevenDaysAgo).length;

  // ── Win rate ──────────────────────────────────────────────────────────────
  const totalClosed = (stageMap["WON"] ?? 0) + (stageMap["LOST"] ?? 0);
  const winRate = totalClosed > 0
    ? Math.round(((stageMap["WON"] ?? 0) / totalClosed) * 100)
    : null;

  // ── Conversion rate ───────────────────────────────────────────────────────
  const leadConversionRate = totalConversations > 0
    ? Math.round((totalLeads / totalConversations) * 100)
    : 0;

  // ── Daily trend (last 14 days) ────────────────────────────────────────────
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const dailyTrend: { date: string; messages: number; conversations: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const day = new Date(fourteenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    dailyTrend.push({
      date: day,
      messages: messagesPerDay[day] ?? 0,
      conversations: convsPerDay[day] ?? 0,
    });
  }

  return NextResponse.json({
    overview: {
      totalConversations,
      totalLeads,
      leadConversionRate,
      qualifiedLeads: leadsQualified,
      wonLeads: leadsWon,
      winRate,
      avgResponseMs,
      escalatedCount,
    },
    stages: {
      NEW: stageMap["NEW"] ?? 0,
      CONTACTED: stageMap["CONTACTED"] ?? 0,
      QUALIFIED: stageMap["QUALIFIED"] ?? 0,
      PROPOSAL: stageMap["PROPOSAL"] ?? 0,
      NEGOTIATION: stageMap["NEGOTIATION"] ?? 0,
      WON: stageMap["WON"] ?? 0,
      LOST: stageMap["LOST"] ?? 0,
    },
    channels: {
      WHATSAPP: { messages: channelMessages["WHATSAPP"] ?? 0, leads: channelLeads["WHATSAPP"] ?? 0 },
      WEB_CHAT: { messages: channelMessages["WEB_CHAT"] ?? 0, leads: channelLeads["WEB_CHAT"] ?? 0 },
      INSTAGRAM: { messages: channelMessages["INSTAGRAM"] ?? 0, leads: channelLeads["INSTAGRAM"] ?? 0 },
      EMAIL: { messages: channelMessages["EMAIL"] ?? 0, leads: channelLeads["EMAIL"] ?? 0 },
    },
    peakHours,
    last7d: {
      messages: last7dMessages,
      conversations: last7dConversations,
      leads: last7dLeads,
    },
    dailyTrend,
    agentLogsCount: agentLogs.length,
  });
}
