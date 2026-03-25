"use client";

import { useState, useEffect } from "react";

interface Stats {
  totalConversations: number;
  totalLeads: number;
  qualifiedLeads: number;
  avgResponseMs: number | null;
}

function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function DashboardRoot() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setStats(data);
        }
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
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
            {[
              { channel: "WhatsApp", preview: "Hi, I want to know about pricing", time: "2m ago", status: "resolved" },
              { channel: "Instagram", preview: "Can you help me set up the integration?", time: "14m ago", status: "active" },
              { channel: "Web Chat", preview: "Is there a free trial?", time: "1h ago", status: "qualified" },
              { channel: "Email", preview: "Following up on our demo last week", time: "3h ago", status: "escalated" },
            ].map((conv) => (
              <div key={conv.channel} className="flex items-start gap-3 pb-3 border-b border-[#F1F5F9] last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[#0A0F1C]">{conv.channel}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      conv.status === "resolved" ? "bg-[#00C853]/10 text-[#00C853]" :
                      conv.status === "active" ? "bg-blue-100 text-blue-600" :
                      conv.status === "qualified" ? "bg-purple-100 text-purple-600" :
                      "bg-amber-100 text-amber-600"
                    }`}>{conv.status}</span>
                  </div>
                  <p className="text-sm text-[#64748B] truncate mt-0.5">{conv.preview}</p>
                </div>
                <span className="text-xs text-[#94A3B8] flex-shrink-0">{conv.time}</span>
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
