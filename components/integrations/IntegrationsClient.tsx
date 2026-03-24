"use client";

import { useState, useEffect } from "react";
import WhatsAppQRModal from "@/components/integrations/WhatsAppQRModal";

interface Integration {
  id: string;
  channel: string;
  status: string;
}

interface Workspace {
  id: string;
  name: string;
  integrations: Integration[];
}

interface IntegrationsClientProps {
  workspace: Workspace | null;
  session: { user: { id: string } };
}

export default function IntegrationsClient({ workspace, session }: IntegrationsClientProps) {
  const [showModal, setShowModal] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [waStatus, setWaStatus] = useState<{ status: string; message?: string } | null>(null);

  // Poll WhatsApp live status
  useEffect(() => {
    if (!workspace) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/whatsapp/status`, {
          headers: { "x-workspace-id": workspace.id },
        });
        if (res.ok) {
          const data = await res.json();
          setWaStatus(data);
        }
      } catch (_) {}
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [workspace, refreshKey]);

  const integrations = workspace?.integrations ?? [];

  const channelMeta: Record<string, { label: string; icon: string; description: string; docsUrl: string }> = {
    WHATSAPP: {
      label: "WhatsApp",
      icon: "📱",
      description: "Connect via QR code — no Meta account needed",
      docsUrl: "#",
    },
    INSTAGRAM: {
      label: "Instagram",
      icon: "📸",
      description: "Automate Instagram DMs and comments with AI",
      docsUrl: "https://developers.facebook.com/docs/instagram",
    },
    EMAIL: {
      label: "Email",
      icon: "📧",
      description: "Handle inbound and outbound email with AI",
      docsUrl: "https://resend.com",
    },
    WEB_CHAT: {
      label: "Web Chat",
      icon: "💬",
      description: "Embed our widget on your website",
      docsUrl: "#",
    },
  };

  const crms = [
    { name: "HubSpot", icon: "🔶", desc: "Sync leads and deals" },
    { name: "Zoho CRM", icon: "🟢", desc: "Automate Zoho workflows" },
    { name: "Pipedrive", icon: "🔴", desc: "Pipeline management" },
  ];

  const handleSuccess = () => {
    setShowModal(null);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div key={refreshKey}>
      <h1 className="text-2xl font-bold text-[#0A0F1C] mb-1">Integrations</h1>
      <p className="text-[#64748B] mb-8">Connect your channels to start automating conversations</p>

      <div className="grid grid-cols-2 gap-5">
        {Object.entries(channelMeta).map(([channel, meta]) => {
          const connected = integrations.find((i) => i.channel === channel);
          const isConnected = connected?.status === "CONNECTED";
          const isWaLive = channel === "WHATSAPP" && waStatus?.status === "connected";

          return (
            <div
              key={channel}
              className={`p-6 rounded-2xl border transition-colors ${
                isConnected || isWaLive
                  ? "bg-[#00C853]/5 border-[#00C853]/30"
                  : "bg-white border-[#E2E8F0]"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{meta.icon}</span>
                  <div>
                    <h3 className="font-semibold text-[#0A0F1C]">{meta.label}</h3>
                    <p className="text-xs text-[#64748B]">{meta.description}</p>
                  </div>
                </div>
                {isConnected ? (
                  <span className="text-xs text-[#00C853] bg-[#00C853]/10 px-2 py-1 rounded-full font-medium">
                    Connected
                  </span>
                ) : isWaLive ? (
                  <span className="text-xs text-[#25D366] bg-[#25D366]/10 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" />
                    Live
                  </span>
                ) : channel === "WHATSAPP" && waStatus?.status === "connecting" ? (
                  <span className="text-xs text-[#25D366] bg-[#25D366]/10 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" />
                    Connecting
                  </span>
                ) : (
                  <span className="text-xs text-[#94A3B8] bg-[#F1F5F9] px-2 py-1 rounded-full">
                    Not connected
                  </span>
                )}
              </div>

              {/* WhatsApp live status bar */}
              {isWaLive && (
                <div className="mb-3 p-2 rounded-lg bg-[#25D366]/5 border border-[#25D366]/20 flex items-center gap-2">
                  <span className="text-xs text-[#25D366] font-medium">
                    ✅ {waStatus.message ?? "Connected via WhatsApp"}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <a
                  href={meta.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-4 rounded-lg border border-[#E2E8F0] text-center text-sm text-[#334155] hover:bg-[#F8FAFC] transition-colors"
                >
                  View docs
                </a>
                <button
                  onClick={() => setShowModal(channel)}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    isConnected || isWaLive
                      ? "border border-[#E2E8F0] text-[#64748B] hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                      : "bg-[#00C853] text-black hover:bg-[#00E676]"
                  }`}
                >
                  {isConnected || isWaLive ? "Re-scan" : "Connect"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* CRM section */}
      <h2 className="text-xl font-bold text-[#0A0F1C] mt-10 mb-5">CRM</h2>
      <div className="grid grid-cols-3 gap-4">
        {crms.map(({ name, icon, desc }) => (
          <div key={name} className="p-5 rounded-xl bg-white border border-[#E2E8F0]">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl">{icon}</span>
              <div>
                <h3 className="font-medium text-[#0A0F1C] text-sm">{name}</h3>
                <p className="text-xs text-[#64748B]">{desc}</p>
              </div>
            </div>
            <button className="w-full py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#334155] hover:border-[#00C853] hover:text-[#00C853] transition-colors">
              Connect {name}
            </button>
          </div>
        ))}
      </div>

      {/* WhatsApp QR modal */}
      {showModal === "WHATSAPP" && workspace && (
        <WhatsAppQRModal
          workspaceId={workspace.id}
          onClose={() => setShowModal(null)}
          onConnected={() => handleSuccess()}
        />
      )}
    </div>
  );
}
