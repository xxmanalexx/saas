"use client";

import { useState, useEffect } from "react";

const STAGES = ["QUALIFIED", "CONTACTED", "NEW", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;
type Stage = typeof STAGES[number];

interface LeadEvent {
  type: string;
  createdAt: string;
  data: Record<string, unknown>;
}

interface Contact {
  channel: string;
  channelIdentifier: string;
  profile: Record<string, string>;
}

interface Lead {
  id: string;
  score: number;
  stage: string;
  contact: Contact;
  events: LeadEvent[];
  createdAt: string;
}

const STAGE_COLORS: Record<string, string> = {
  QUALIFIED:   "bg-[#00C853]/10 text-[#00C853]",
  WON:        "bg-blue-100 text-blue-600",
  LOST:       "bg-red-100 text-red-600",
  CONTACTED:  "bg-purple-100 text-purple-600",
  PROPOSAL:   "bg-amber-100 text-amber-600",
  NEGOTIATION:"bg-orange-100 text-orange-600",
  NEW:        "bg-[#F1F5F9] text-[#64748B]",
};

const STAGE_BAR_COLOR: Record<string, string> = {
  QUALIFIED:  "bg-[#00C853]",
  WON:        "bg-blue-500",
  LOST:       "bg-red-400",
  CONTACTED:  "bg-purple-500",
  PROPOSAL:   "bg-amber-400",
  NEGOTIATION:"bg-orange-400",
  NEW:        "bg-[#94A3B8]",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchLeads = () => {
    setLoading(true);
    fetch("/api/leads")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.leads)) setLeads(data.leads);
        else if (Array.isArray(data)) setLeads(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const changeStage = async (leadId: string, newStage: Stage) => {
    if (updating) return;
    setUpdating(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (res.ok) {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId
              ? { ...l, stage: newStage, score: newStage === "WON" ? 100 : newStage === "LOST" ? 0 : l.score }
              : l
          )
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(null);
    }
  };

  const deleteLead = async (leadId: string) => {
    if (!confirm("Delete this lead? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      if (res.ok) {
        setLeads((prev) => prev.filter((l) => l.id !== leadId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#0A0F1C]">Lead Pipeline</h1>
        <span className="text-sm text-[#64748B]">{leads.length} leads</span>
      </div>

      {/* Stage summary */}
      <div className="grid grid-cols-7 gap-3 mb-6">
        {STAGES.map((stage) => {
          const count = leads.filter((l) => l.stage === stage).length;
          return (
            <div key={stage} className="bg-white rounded-xl border border-[#E2E8F0] p-4 text-center">
              <div className="text-2xl font-bold text-[#0A0F1C]">{count}</div>
              <div className="text-xs text-[#64748B] mt-1">{stage}</div>
            </div>
          );
        })}
      </div>

      {/* Leads table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase">Channel</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase">Score</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase">Stage</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase">Last Activity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[#94A3B8]">Loading...</td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[#94A3B8]">
                  No leads yet — conversations will generate qualified leads automatically.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-[#0A0F1C]">
                      {lead.contact.profile?.name ?? lead.contact.channelIdentifier}
                    </div>
                    <div className="text-xs text-[#94A3B8]">{lead.contact.channelIdentifier}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">{lead.contact.channel}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${STAGE_BAR_COLOR[lead.stage] ?? "bg-[#94A3B8]"}`}
                          style={{ width: `${lead.score}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-[#334155]">{lead.score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={lead.stage}
                      disabled={updating === lead.id}
                      onChange={(e) => changeStage(lead.id, e.target.value as Stage)}
                      className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer font-medium focus:outline-none ${
                        STAGE_COLORS[lead.stage] ?? "bg-[#F1F5F9] text-[#64748B]"
                      }`}
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">
                    {lead.events?.[0]
                      ? new Date(lead.events[0].createdAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteLead(lead.id)}
                      className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                      title="Delete lead"
                    >
                      🗑 Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
