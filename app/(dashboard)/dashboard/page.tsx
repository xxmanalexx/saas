"use client";

import { useState, useEffect } from "react";

interface Stats {
  totalConversations: number;
  totalLeads: number;
  qualifiedLeads: number;
  avgResponseMs: number | null;
}

interface ConversationMessage {
  content: string;
  createdAt: string;
}

interface ConversationContact {
  channel: string;
  channelIdentifier: string;
  profile: Record<string, string>;
}

interface DashboardConversation {
  id: string;
  channel: string;
  status: string;
  updatedAt: string;
  contact: ConversationContact | null;
  messages: ConversationMessage[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function DashboardRoot() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [conversations, setConversations] = useState<DashboardConversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setStats(data);
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setConversations(data.slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setConvLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#0A0F1C]">Good morning, Abdalla</h1>
        <p className="text-[#64748B] mt-1">
          Here&apos;s what happened while you slept. 🦾
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-6">
        {[
          { label: "Conversations", value: statsLoading ? "—" : String(stats?.totalConversations ?? "—"), delta: null, icon: "💬" },
          { label: "Leads Qualified", value: statsLoading ? "—" : String(stats?.qualifiedLeads ?? "—"), delta: null, icon: "🎯" },
          { label: "Avg Response Time", value: formatMs(stats?.avgResponseMs ?? null), delta: null, icon: "⚡" },
          { label: "Total Leads", value: statsLoading ? "—" : String(stats?.totalLeads ?? "—"), delta: null, icon: "📈" },
        ].map(({ label, value, delta, icon }) => (
          <div
            key={label}
            className="bg-white rounded-xl p-6 border border-[#E2E8F0] shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{icon}</span>
              {delta && (
                <span className="text-xs font-medium text-[#00C853] bg-[#00C853]/10 px-2 py-1 rounded-full">
                  {delta}
                </span>
              )}
            </div>
            <div className="text-3xl font-bold text-[#0A0F1C]">{value}</div>
            <div className="text-sm text-[#64748B] mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6">
          <h2 className="font-semibold text-[#0A0F1C] mb-4">Recent Conversations</h2>
          <div className="space-y-3">
            {convLoading ? (
              <div className="text-sm text-[#94A3B8] py-4 text-center">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="text-sm text-[#94A3B8] py-4 text-center">No conversations yet</div>
            ) : conversations.map((conv) => (
              <div key={conv.id} className="flex items-start gap-3 pb-3 border-b border-[#F1F5F9] last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[#0A0F1C]">{conv.channel ?? conv.contact?.channel ?? "—"}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      conv.status === "ACTIVE" ? "bg-blue-100 text-blue-600" :
                      conv.status === "ESCALATED" ? "bg-amber-100 text-amber-600" :
                      conv.status === "RESOLVED" ? "bg-[#00C853]/10 text-[#00C853]" :
                      "bg-[#F1F5F9] text-[#64748B]"
                    }`}>{conv.status ?? "—"}</span>
                  </div>
                  <p className="text-sm text-[#64748B] truncate mt-0.5">
                    {conv.messages?.[0]?.content
                      ? conv.messages[0].content.slice(0, 60)
                      : conv.contact?.profile?.name ?? conv.contact?.channelIdentifier ?? "—"}
                  </p>
                </div>
                <span className="text-xs text-[#94A3B8] flex-shrink-0">
                  {conv.updatedAt ? timeAgo(conv.updatedAt) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6">
          <h2 className="font-semibold text-[#0A0F1C] mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { label: "View all conversations", href: "/dashboard/conversations" },
              { label: "Review lead pipeline", href: "/dashboard/leads" },
              { label: "Connect new channel", href: "/dashboard/integrations" },
              { label: "Configure AI agents", href: "/dashboard/settings" },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[#E2E8F0] hover:border-[#00C853] hover:bg-[#00C853]/5 transition-colors text-sm text-[#334155]"
              >
                <span>{label}</span>
                <span className="ml-auto text-[#00C853]">→</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
