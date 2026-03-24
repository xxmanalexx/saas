"use client";

import { useState, useEffect } from "react";

interface KBEntry {
  id?: string;
  title: string;
  content: string;
  category: string;
  isActive?: boolean;
}

const CATEGORIES = [
  { value: "general", label: "General", emoji: "📋" },
  { value: "faq", label: "FAQ", emoji: "❓" },
  { value: "pricing", label: "Pricing & Plans", emoji: "💰" },
  { value: "policy", label: "Policies", emoji: "📜" },
  { value: "product", label: "Products / Services", emoji: "🛍️" },
];

const SAMPLE_ENTRIES: KBEntry[] = [
  {
    title: "Our Services",
    content: "We offer AI-powered customer automation for businesses in the MENA region. Our platform handles WhatsApp, Instagram, email, and web chat — qualifying leads, booking appointments, and providing support 24/7.",
    category: "general",
  },
  {
    title: "Business Hours",
    content: "We are available Sunday to Thursday, 9 AM to 6 PM GST. For urgent matters outside business hours, please email support@example.com and we will respond the next business day.",
    category: "general",
  },
  {
    title: "Pricing",
    content: "Starter: $49/mo — 1,000 conversations, 500 leads, 3 integrations. Growth: $149/mo — 10,000 conversations, 5,000 leads, 10 integrations. Enterprise: $499/mo — unlimited everything + priority support.",
    category: "pricing",
  },
  {
    title: "Refund Policy",
    content: "We offer a 14-day money-back guarantee for all new subscriptions. If you're not satisfied, contact support within 14 days of purchase for a full refund — no questions asked.",
    category: "policy",
  },
];

export default function KnowledgeBasePage() {
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<KBEntry | null>(null);
  const [form, setForm] = useState<KBEntry>({ title: "", content: "", category: "general" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/knowledge")
      .then((r) => r.json())
      .then((data) => {
        // If no entries yet, seed with samples
        if (!Array.isArray(data) || data.length === 0) {
          setEntries(SAMPLE_ENTRIES);
        } else {
          setEntries(data);
        }
      })
      .catch(() => setEntries(SAMPLE_ENTRIES))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content) return;
    setSaving(true);
    setMsg("");

    try {
      if (editing?.id) {
        await fetch(`/api/knowledge/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        setEntries((prev) => prev.map((e) => (e.id === editing.id ? { ...form, id: editing.id } : e)));
        setMsg("✅ Entry updated!");
      } else {
        const res = await fetch("/api/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const created = await res.json();
        setEntries((prev) => [created, ...prev]);
        setMsg("✅ Entry added!");
      }
      setShowForm(false);
      setEditing(null);
      setForm({ title: "", content: "", category: "general" });
    } catch {
      setMsg("❌ Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const openEdit = (entry: KBEntry) => {
    setEditing(entry);
    setForm({ title: entry.title, content: entry.content, category: entry.category });
    setShowForm(true);
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#0A0F1C] mb-1">Knowledge Base</h1>
          <p className="text-[#64748B] text-sm">Train your AI agent about your business.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setForm({ title: "", content: "", category: "general" }); setShowForm(true); }}
          className="px-4 py-2.5 rounded-xl bg-[#00C853] text-black text-sm font-semibold hover:bg-[#00E676] transition-colors flex items-center gap-2"
        >
          <span>+</span> Add Entry
        </button>
      </div>

      {msg && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-[#00C853]/10 border border-[#00C853]/20 text-[#00C853] text-sm">
          {msg}
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {CATEGORIES.map((cat) => {
          const count = entries.filter((e) => e.category === cat.value).length;
          return (
            <div key={cat.value} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E2E8F0] text-sm text-[#334155]">
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
              <span className="text-xs bg-[#F1F5F9] px-1.5 rounded-full text-[#64748B]">{count}</span>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#64748B]">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-[#64748B]">
          No knowledge base entries yet. Add your first one!
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, i) => {
            const cat = CATEGORIES.find((c) => c.value === entry.category);
            return (
              <div key={entry.id ?? i} className="bg-white rounded-xl border border-[#E2E8F0] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{cat?.emoji ?? "📋"}</span>
                    <h3 className="font-semibold text-[#0A0F1C]">{entry.title}</h3>
                    <span className="text-xs text-[#94A3B8] bg-[#F1F5F9] px-2 py-0.5 rounded-full">
                      {cat?.label ?? entry.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(entry)}
                      className="px-3 py-1.5 rounded-lg text-xs text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#334155] transition-colors"
                    >
                      Edit
                    </button>
                    {entry.id && (
                      <button
                        onClick={() => handleDelete(entry.id!)}
                        className="px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-sm text-[#64748B] leading-relaxed">{entry.content}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1F5F9]">
              <h2 className="font-semibold text-[#0A0F1C]">{editing ? "Edit Entry" : "Add Knowledge Entry"}</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:bg-[#F8FAFC]">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-1.5">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Our Refund Policy"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-[#0A0F1C] focus:outline-none focus:border-[#00C853]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-1.5">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-[#0A0F1C] focus:outline-none focus:border-[#00C853]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-1.5">Content</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="The information your AI agent should know..."
                  rows={5}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-[#0A0F1C] focus:outline-none focus:border-[#00C853] resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] text-[#334155] text-sm font-medium hover:bg-[#F8FAFC]">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#00C853] text-black text-sm font-semibold hover:bg-[#00E676] disabled:opacity-50">
                  {saving ? "Saving..." : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
