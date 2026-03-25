"use client";

import { useState, useEffect } from "react";

interface AnalyticsOverview {
  totalConversations: number;
  totalLeads: number;
  leadConversionRate: number;
  qualifiedLeads: number;
  wonLeads: number;
  winRate: number | null;
  avgResponseMs: number | null;
  escalatedCount: number;
}

interface StageData {
  NEW: number;
  CONTACTED: number;
  QUALIFIED: number;
  PROPOSAL: number;
  NEGOTIATION: number;
  WON: number;
  LOST: number;
}

interface ChannelData {
  messages: number;
  leads: number;
}

interface DailyTrend {
  date: string;
  messages: number;
  conversations: number;
}

interface PeakHour {
  hour: number;
  count: number;
}

interface AnalyticsData {
  overview: AnalyticsOverview;
  stages: StageData;
  channels: Record<string, ChannelData>;
  peakHours: PeakHour[];
  last7d: { messages: number; conversations: number; leads: number };
  dailyTrend: DailyTrend[];
  agentLogsCount: number;
}

function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatHour(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h}:00 ${suffix}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Simple bar chart from array of { label, value }
function BarChart({ data, maxValue, color }: { data: { label: string; value: number }[]; maxValue: number; color: string }) {
  return (
    <div className="flex items-end gap-1 h-32 mt-3">
      {data.map((item, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="text-xs font-medium text-[#334155] w-full text-right pr-1">
            {item.value}
          </div>
          <div
            className={`w-full rounded-t ${color} transition-all`}
            style={{
              height: `${maxValue > 0 ? Math.max(4, (item.value / maxValue) * 96) : 4}px`,
              minHeight: "4px",
            }}
          />
          <div className="text-xs text-[#94A3B8] text-center leading-tight">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"7d" | "14d" | "30d">("14d");

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load analytics");
        return r.json();
      })
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-[#64748B]">Loading analytics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-600">
        Error loading analytics: {error}
      </div>
    );
  }

  const { overview, stages, channels, peakHours, last7d, dailyTrend } = data;

  // Pipeline funnel stages (ordered)
  const funnelStages = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON"] as const;
  // Include LOST in the max so the relative widths are correct (2 lost vs 1 won = LOST bar is 2x wider)
  const funnelMax = Math.max(
    ...funnelStages.map((s) => stages[s] ?? 0),
    stages.LOST ?? 0,
    1,
  );

  // Daily trend for chart
  const trendDays = period === "7d" ? dailyTrend.slice(-7) : dailyTrend;
  const trendMax = Math.max(...trendDays.map((d) => d.messages), 1);

  // Channel data for chart
  const channelEntries = Object.entries(channels)
    .filter(([, v]) => v.messages > 0 || v.leads > 0)
    .sort((a, b) => b[1].messages - a[1].messages);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0A0F1C]">Analytics</h1>
          <p className="text-sm text-[#64748B] mt-1">Business performance over the last 30 days</p>
        </div>
        <div className="flex gap-2">
          {(["7d", "14d", "30d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? "bg-[#00C853] text-white"
                  : "bg-white border border-[#E2E8F0] text-[#64748B] hover:border-[#00C853]"
              }`}
            >
              {p === "7d" ? "7 days" : p === "14d" ? "14 days" : "30 days"}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <div className="text-xs text-[#64748B] mb-2">Total Conversations</div>
          <div className="text-3xl font-bold text-[#0A0F1C]">{overview.totalConversations}</div>
          <div className="text-xs text-[#94A3B8] mt-1">+{last7d.conversations} this week</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <div className="text-xs text-[#64748B] mb-2">Leads Generated</div>
          <div className="text-3xl font-bold text-[#0A0F1C]">{overview.totalLeads}</div>
          <div className="text-xs text-[#94A3B8] mt-1">+{last7d.leads} this week</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <div className="text-xs text-[#64748B] mb-2">Conversion Rate</div>
          <div className="text-3xl font-bold text-[#0A0F1C]">{overview.leadConversionRate}%</div>
          <div className="text-xs text-[#94A3B8] mt-1">of all conversations → leads</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <div className="text-xs text-[#64748B] mb-2">Win Rate</div>
          <div className="text-3xl font-bold text-[#0A0F1C]">
            {overview.winRate !== null ? `${overview.winRate}%` : "—"}
          </div>
          <div className="text-xs text-[#94A3B8] mt-1">{stages.WON} won / {(stages.WON + stages.LOST) || 0} closed</div>
        </div>
      </div>

      {/* ── Second row: Avg Response, Escalated, Peak Hours, Leads/Conv ───── */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <div className="text-xs text-[#64748B] mb-2">Avg Response Time</div>
          <div className="text-3xl font-bold text-[#0A0F1C]">{formatMs(overview.avgResponseMs)}</div>
          <div className="text-xs text-[#94A3B8] mt-1">via Ollama AI agent</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <div className="text-xs text-[#64748B] mb-2">Escalated to Human</div>
          <div className="text-3xl font-bold text-red-500">{overview.escalatedCount}</div>
          <div className="text-xs text-[#94A3B8] mt-1">required human takeover</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <div className="text-xs text-[#64748B] mb-2">Peak Hours</div>
          <div className="space-y-1 mt-1">
            {peakHours.slice(0, 3).map(({ hour, count }) => (
              <div key={hour} className="flex items-center justify-between text-sm">
                <span className="text-[#334155]">{formatHour(hour)}</span>
                <span className="text-[#00C853] font-medium">{count} msgs</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <div className="text-xs text-[#64748B] mb-2">Qualified Leads</div>
          <div className="text-3xl font-bold text-[#0A0F1C]">{stages.QUALIFIED}</div>
          <div className="text-xs text-[#94A3B8] mt-1">{stages.PROPOSAL} in proposal · {stages.NEGOTIATION} in negotiation</div>
        </div>
      </div>

      {/* ── Daily Message Trend ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-[#0A0F1C]">Message Volume</h2>
          <span className="text-xs text-[#94A3B8]">{period === "7d" ? "Last 7 days" : "Last 14 days"}</span>
        </div>
        {trendDays.every((d) => d.messages === 0) ? (
          <div className="text-sm text-[#94A3B8] py-8 text-center">No message data available yet</div>
        ) : (
          <BarChart
            data={trendDays.map((d) => ({
              label: formatDate(d.date),
              value: d.messages,
            }))}
            maxValue={trendMax}
            color="bg-[#00C853]"
          />
        )}
      </div>

      {/* ── Lead Pipeline Funnel ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
        <h2 className="font-semibold text-[#0A0F1C] mb-4">Lead Pipeline</h2>
        <div className="space-y-3">
          {funnelStages.map((stage, i) => {
            const count = stages[stage] ?? 0;
            const pct = Math.max(4, Math.round((count / funnelMax) * 100));
            const colors: Record<string, string> = {
              NEW: "bg-[#94A3B8]",
              CONTACTED: "bg-purple-400",
              QUALIFIED: "bg-[#00C853]",
              PROPOSAL: "bg-amber-400",
              NEGOTIATION: "bg-orange-400",
              WON: "bg-blue-500",
            };
            return (
              <div key={stage} className="flex items-center gap-3">
                <div className="w-24 text-xs text-[#64748B] text-right">{stage}</div>
                <div className="flex-1 h-7 bg-[#F1F5F9] rounded-lg overflow-hidden relative">
                  <div
                    className={`h-full rounded-lg ${colors[stage]} transition-all flex items-center justify-end pr-3`}
                    style={{ width: `${pct}%` }}
                  >
                    <span className="text-xs font-semibold text-white">{count}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {stages.LOST > 0 && (
            <div className="flex items-center gap-3 pt-2 border-t border-[#F1F5F9]">
              <div className="w-24 text-xs text-[#64748B] text-right">LOST</div>
              <div className="flex-1 h-7 bg-red-100 rounded-lg overflow-hidden relative">
                <div
                  className="h-full rounded-lg bg-red-400 flex items-center justify-end pr-3"
                  style={{ width: `${Math.max(4, Math.round((stages.LOST / funnelMax) * 100))}%` }}
                >
                  <span className="text-xs font-semibold text-white">{stages.LOST}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Channel Performance ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
          <h2 className="font-semibold text-[#0A0F1C] mb-4">Channel Performance</h2>
          {channelEntries.length === 0 ? (
            <div className="text-sm text-[#94A3B8] py-6 text-center">No channel data yet</div>
          ) : (
            <div className="space-y-4">
              {channelEntries.map(([channel, stats]) => {
                const total = stats.messages + stats.leads;
                return (
                  <div key={channel}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[#0A0F1C]">{channel.replace("_", " ")}</span>
                      <div className="flex gap-4 text-xs text-[#64748B]">
                        <span>{stats.messages} msgs</span>
                        <span>{stats.leads} leads</span>
                      </div>
                    </div>
                    <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden flex">
                      <div
                        className="bg-[#00C853] h-full"
                        style={{ width: `${total > 0 ? (stats.messages / total) * 100 : 0}%` }}
                      />
                      <div
                        className="bg-purple-400 h-full"
                        style={{ width: `${total > 0 ? (stats.leads / total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-4 text-xs text-[#94A3B8] pt-2">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#00C853] inline-block" /> Messages</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-purple-400 inline-block" /> Leads</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Stage Breakdown ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
          <h2 className="font-semibold text-[#0A0F1C] mb-4">Lead Stage Distribution</h2>
          <div className="space-y-3">
            {(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const).map((stage) => {
              const count = stages[stage] ?? 0;
              const totalLeads = Object.values(stages).reduce((a, b) => a + b, 0);
              const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
              const colors: Record<string, string> = {
                NEW: "bg-[#94A3B8]",
                CONTACTED: "bg-purple-400",
                QUALIFIED: "bg-[#00C853]",
                PROPOSAL: "bg-amber-400",
                NEGOTIATION: "bg-orange-400",
                WON: "bg-blue-500",
                LOST: "bg-red-400",
              };
              return (
                <div key={stage} className="flex items-center gap-3">
                  <div className="w-20 text-xs text-[#64748B]">{stage}</div>
                  <div className="flex-1 h-5 bg-[#F1F5F9] rounded overflow-hidden">
                    <div
                      className={`h-full ${colors[stage]} rounded flex items-center justify-end pr-2`}
                      style={{ width: `${pct}%`, minWidth: count > 0 ? "24px" : "0" }}
                    >
                      {count > 0 && <span className="text-xs font-medium text-white">{count}</span>}
                    </div>
                  </div>
                  <div className="w-10 text-xs text-[#94A3B8] text-right">{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
