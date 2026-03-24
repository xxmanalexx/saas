"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface WhatsAppConfigModalProps {
  workspaceId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function WhatsAppConfigModal({
  workspaceId,
  onClose,
  onSuccess,
}: WhatsAppConfigModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    accessToken: "",
    phoneNumberId: "",
    businessAccountId: "",
    verifyToken: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          channel: "WHATSAPP",
          credentials: {
            accessToken: form.accessToken,
            phoneNumberId: form.phoneNumberId,
            businessAccountId: form.businessAccountId,
            verifyToken: form.verifyToken,
          },
          settings: {},
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to connect");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1F5F9]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📱</span>
            <div>
              <h2 className="font-semibold text-[#0A0F1C]">Connect WhatsApp</h2>
              <p className="text-xs text-[#64748B]">Meta Business API</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#334155] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          <p className="text-sm text-[#64748B]">
            You need a WhatsApp Business API account on Meta.{" "}
            <a
              href="https://developers.facebook.com/docs/whatsapp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#00C853] hover:underline"
            >
              Read the setup guide →
            </a>
          </p>

          <div>
            <label className="block text-sm font-medium text-[#334155] mb-1.5">
              Permanent Access Token
            </label>
            <input
              type="password"
              value={form.accessToken}
              onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))}
              placeholder="EAACEdEose0cBA..."
              required
              className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] text-[#0A0F1C] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00C853]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#334155] mb-1.5">
                Phone Number ID
              </label>
              <input
                type="text"
                value={form.phoneNumberId}
                onChange={(e) => setForm((f) => ({ ...f, phoneNumberId: e.target.value }))}
                placeholder="1234567890"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] text-[#0A0F1C] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00C853]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#334155] mb-1.5">
                Business Account ID
              </label>
              <input
                type="text"
                value={form.businessAccountId}
                onChange={(e) => setForm((f) => ({ ...f, businessAccountId: e.target.value }))}
                placeholder="123456789"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] text-[#0A0F1C] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00C853]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#334155] mb-1.5">
              Verify Token
            </label>
            <input
              type="text"
              value={form.verifyToken}
              onChange={(e) => setForm((f) => ({ ...f, verifyToken: e.target.value }))}
              placeholder="Any random string you choose"
              required
              className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] text-[#0A0F1C] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00C853]"
            />
            <p className="text-xs text-[#94A3B8] mt-1.5">
              Set this same token in your Meta webhook configuration.
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-[#E2E8F0] text-[#334155] text-sm font-medium hover:bg-[#F8FAFC] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors",
                loading
                  ? "bg-[#00C853]/50 text-black/50 cursor-not-allowed"
                  : "bg-[#00C853] text-black hover:bg-[#00E676]"
              )}
            >
              {loading ? "Connecting..." : "Connect WhatsApp"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
