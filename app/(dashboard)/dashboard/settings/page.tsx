"use client";

import { useState, useEffect } from "react";
import { clearOllamaCache } from "@/lib/ollamaConfig";

interface Persona {
  id?: string;
  name: string;
  role: string;
  tone: string;
  language: string;
  dialect: string;
  emojiStyle: string;
  instructions: string;
  isDefault: boolean;
}

interface Settings {
  id?: string;
  name: string;
  ollamaUrl: string;
  ollamaModel: string;
  databaseUrl: string;
  defaultPersona: Persona | null;
}

const ROLES = ["RECEPTIONIST", "MARKETER", "SALES", "SUPPORT", "GENERAL"];
const TONES = ["FRIENDLY", "PROFESSIONAL", "CASUAL", "FORMAL"];
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ar", label: "Arabic (العربية)" },
  { code: "hi", label: "Hindi (हिन्दी)" },
  { code: "fr", label: "French (Français)" },
  { code: "es", label: "Spanish (Español)" },
  { code: "ur", label: "Urdu (اردو)" },
];
const EMOJI_STYLES = [
  { value: "NEVER", label: "Never use emojis" },
  { value: "SOMETIMES", label: "Use emojis sometimes" },
  { value: "OFTEN", label: "Use emojis often" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Persona form state
  const [persona, setPersona] = useState<Persona>({
    name: "",
    role: "SUPPORT",
    tone: "FRIENDLY",
    language: "en",
    dialect: "",
    emojiStyle: "SOMETIMES",
    instructions: "",
    isDefault: true,
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setSettings(d);
        if (d.defaultPersona) {
          setPersona(d.defaultPersona);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMsg("");

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: settings.name,
          ollamaUrl: settings.ollamaUrl,
          ollamaModel: settings.ollamaModel,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      // Clear the Ollama config cache so new values take effect immediately
      if (settings.id) clearOllamaCache(settings.id);

      // Save/update persona — PATCH if it exists, POST to create if new
      const personaMethod = persona.id ? "PATCH" : "POST";
      const personaRes = await fetch("/api/personas", {
        method: personaMethod,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(persona),
      });

      if (!personaRes.ok) throw new Error("Failed to save persona");

      // Re-fetch fresh persona data from server so UI is always in sync
      const personasData = await fetch("/api/personas").then((r) => r.json());
      const latestDefault = Array.isArray(personasData)
        ? personasData.find((p: Persona) => p.isDefault) ?? personasData[0]
        : null;
      if (latestDefault) setPersona(latestDefault);

      setMsg("✅ Settings saved!");
    } catch {
      setMsg("❌ Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-[#64748B]">Loading...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-[#0A0F1C] mb-1">Settings</h1>
      <p className="text-[#64748B] mb-8">Configure your AI agent and workspace.</p>

      {msg && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-[#00C853]/10 border border-[#00C853]/20 text-[#00C853] text-sm">
          {msg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">

        {/* ── Workspace ── */}
        <section className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
          <h2 className="font-semibold text-[#0A0F1C] mb-4">Workspace</h2>
          <div>
            <label className="block text-sm font-medium text-[#334155] mb-1.5">Workspace name</label>
            <input
              type="text"
              value={settings?.name ?? ""}
              onChange={(e) => setSettings((s) => s ? { ...s, name: e.target.value } : s)}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-[#0A0F1C] focus:outline-none focus:border-[#00C853]"
            />
          </div>
        </section>

        {/* ── Database ── */}
        <section className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🗄️</span>
            <h2 className="font-semibold text-[#0A0F1C]">Database</h2>
          </div>
          <p className="text-xs text-[#64748B] mb-4">Custom PostgreSQL connection string (Neon, Supabase, etc.). Leave empty to use the server's default DATABASE_URL.</p>
          <div>
            <label className="block text-sm font-medium text-[#334155] mb-1.5">Connection string</label>
            <input
              type="password"
              value={settings?.databaseUrl ?? ""}
              onChange={(e) => setSettings((s) => s ? { ...s, databaseUrl: e.target.value } : s)}
              placeholder="postgresql://user:pass@host:5432/dbname?sslmode=require"
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-[#0A0F1C] focus:outline-none focus:border-[#00C853]"
            />
            <p className="text-xs text-[#94A3B8] mt-1.5">
              Neon example: <code className="bg-[#F1F5F9] px-1 rounded">postgresql://user:password@ep-xxx.eu-west-2.aws.neon.tech/neondb?sslmode=require</code>
            </p>
          </div>
        </section>

        {/* ── Ollama AI ── */}
        <section className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🤖</span>
            <h2 className="font-semibold text-[#0A0F1C]">AI / Ollama</h2>
          </div>
          <p className="text-xs text-[#64748B] mb-4">Connect to your local Ollama instance. Make sure Ollama is running on your server.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#334155] mb-1.5">Ollama URL</label>
              <input
                type="url"
                value={settings?.ollamaUrl ?? "http://localhost:11434"}
                onChange={(e) => setSettings((s) => s ? { ...s, ollamaUrl: e.target.value } : s)}
                placeholder="http://localhost:11434"
                className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-[#0A0F1C] focus:outline-none focus:border-[#00C853]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#334155] mb-1.5">Model name</label>
              <input
                type="text"
                value={settings?.ollamaModel ?? "llama3.2"}
                onChange={(e) => setSettings((s) => s ? { ...s, ollamaModel: e.target.value } : s)}
                placeholder="llama3.2"
                className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-[#0A0F1C] focus:outline-none focus:border-[#00C853]"
              />
              <p className="text-xs text-[#94A3B8] mt-1.5">
                Run <code className="bg-[#F1F5F9] px-1 rounded">ollama pull llama3.2</code> to download. Other options: mistral, codellama, phi3.
              </p>
            </div>
          </div>
        </section>

        {/* ── Agent Persona ── */}
        <section className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🎭</span>
            <h2 className="font-semibold text-[#0A0F1C]">Agent Persona</h2>
          </div>
          <p className="text-xs text-[#64748B] mb-4">Customize how your AI agent speaks and behaves.</p>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-1.5">Agent name</label>
                <input
                  type="text"
                  value={persona.name}
                  onChange={(e) => setPersona((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Rana"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-[#0A0F1C] focus:outline-none focus:border-[#00C853]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-1.5">Role</label>
                <select
                  value={persona.role}
                  onChange={(e) => setPersona((p) => ({ ...p, role: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-[#0A0F1C] focus:outline-none focus:border-[#00C853]"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-1.5">Tone</label>
                <select
                  value={persona.tone}
                  onChange={(e) => setPersona((p) => ({ ...p, tone: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-[#0A0F1C] focus:outline-none focus:border-[#00C853]"
                >
                  {TONES.map((t) => (
                    <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-1.5">Language</label>
                <select
                  value={persona.language}
                  onChange={(e) => setPersona((p) => ({ ...p, language: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-[#0A0F1C] focus:outline-none focus:border-[#00C853]"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-1.5">Emoji use</label>
                <select
                  value={persona.emojiStyle}
                  onChange={(e) => setPersona((p) => ({ ...p, emojiStyle: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-[#0A0F1C] focus:outline-none focus:border-[#00C853]"
                >
                  {EMOJI_STYLES.map((e) => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-[#334155] mb-1.5">
                  Instructions <span className="text-[#94A3B8] font-normal">(optional)</span>
                </label>
                <textarea
                  value={persona.instructions}
                  onChange={(e) => setPersona((p) => ({ ...p, instructions: e.target.value }))}
                  placeholder="E.g. Always greet warmly. Ask for the customer's name before proceeding. If they ask about pricing, redirect to the pricing page."
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-[#0A0F1C] focus:outline-none focus:border-[#00C853] resize-none"
                />
                <p className="text-xs text-[#94A3B8] mt-1.5">
                  These instructions are injected into every AI response to guide the agent's behavior.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#64748B]">Dialect</label>
                <select
                  value={persona.dialect}
                  onChange={(e) => setPersona({ ...persona, dialect: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm text-[#0A0F1C] focus:outline-none focus:border-[#00C853]"
                >
                  <option value="">None (standard)</option>
                  <option value="khaliji">Khaliji (Gulf Arabic)</option>
                  <option value="iraqi">Iraqi Arabic</option>
                  <option value="shami">Shami (Levantine)</option>
                  <option value="egyptian">Egyptian Arabic</option>
                  <option value="maghrebi">Maghrebi Arabic</option>
                  <option value="saudi">Saudi Arabic</option>
                </select>
                <p className="text-xs text-[#94A8B8]">Helps AI speak in the customer's dialect</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={persona.isDefault}
                onChange={(e) => setPersona((p) => ({ ...p, isDefault: e.target.checked }))}
                className="w-4 h-4 rounded border-[#E2E8F0] text-[#00C853] focus:ring-[#00C853]"
              />
              <label htmlFor="isDefault" className="text-sm text-[#334155]">
                Use this as the default persona for all new conversations
              </label>
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-[#00C853] text-black font-semibold hover:bg-[#00E676] transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
      </form>
    </div>
  );
}
