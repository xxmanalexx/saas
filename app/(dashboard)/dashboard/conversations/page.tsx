"use client";

import { useState, useEffect } from "react";

interface Message {
  content: string;
  createdAt: string;
}

interface Contact {
  id: string;
  channelIdentifier: string;
  profile: Record<string, string>;
}

interface Conversation {
  id: string;
  channel: string;
  channelId: string;
  status: string;
  updatedAt: string;
  contact: Contact | null;
  messages: Message[];
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setConversations(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleAll = () => {
    if (selected.size === conversations.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(conversations.map((c) => c.id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const clearSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} conversation(s)? This cannot be undone.`)) return;

    const ids = Array.from(selected);
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/conversations/${id}`, { method: "DELETE" })
      )
    );
    setSelected(new Set());
    // Re-fetch so new WhatsApp messages don't recreate deleted conversations in the list
    const res = await fetch("/api/conversations");
    const data = await res.json();
    if (Array.isArray(data)) setConversations(data);
  };

  const allSelected = conversations.length > 0 && selected.size === conversations.length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#0A0F1C]">Conversations</h1>
          <span className="text-sm text-[#64748B]">{conversations.length} total</span>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#64748B]">{selected.size} selected</span>
            <button
              onClick={clearSelected}
              className="px-3 py-1.5 rounded-lg text-sm bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
            >
              Delete selected
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 rounded-lg text-sm border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-[#94A3B8]">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="py-12 text-center text-[#94A3B8]">
            No conversations yet — connect a channel to start receiving messages.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-[#CBD5E1] text-[#00C853] focus:ring-[#00C853]"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase tracking-wide">Channel</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase tracking-wide">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase tracking-wide">Last message</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase tracking-wide">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {conversations.map((conv) => (
                <tr
                  key={conv.id}
                  className={`hover:bg-[#F8FAFC] transition-colors cursor-pointer ${selected.has(conv.id) ? "bg-[#00C853]/5" : ""}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(conv.id)}
                      onChange={() => toggle(conv.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-[#CBD5E1] text-[#00C853] focus:ring-[#00C853]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-[#F1F5F9] text-[#334155]">
                      {conv.channel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-[#0A0F1C]">
                      {conv.contact?.profile?.name ?? conv.contact?.channelIdentifier ?? "—"}
                    </div>
                    <div className="text-xs text-[#94A3B8]">{conv.contact?.channelIdentifier ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#64748B] max-w-xs truncate">
                    {conv.messages[0]?.content ?? ""}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      conv.status === "ACTIVE" ? "bg-blue-100 text-blue-600" :
                      conv.status === "ESCALATED" ? "bg-amber-100 text-amber-600" :
                      conv.status === "RESOLVED" ? "bg-[#00C853]/10 text-[#00C853]" :
                      "bg-[#F1F5F9] text-[#64748B]"
                    }`}>{conv.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">
                    {new Date(conv.updatedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
