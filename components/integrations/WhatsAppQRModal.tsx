"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface WhatsAppQRModalProps {
  workspaceId: string;
  onClose: () => void;
  onConnected: () => void;
}

export default function WhatsAppQRModal({
  workspaceId,
  onClose,
  onConnected,
}: WhatsAppQRModalProps) {
  const [step, setStep] = useState<"idle" | "connecting" | "qr" | "connected" | "error">("idle");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const clearPolling = useCallback(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [pollingInterval]);

  // ── Poll status ────────────────────────────────────────────────────────
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/whatsapp/status`, {
        headers: { "x-workspace-id": workspaceId },
      });
      const data = await res.json();

      if (data.status === "connected") {
        setStep("connected");
        clearPolling();
        setStatusMessage(data.message);
        // Refresh parent after 1.5s
        setTimeout(() => onConnected(), 1500);
      } else if (data.status === "error" || data.status === "disconnected") {
        setStep("error");
        setErrorMessage(data.message);
        clearPolling();
      } else if (data.status === "connecting") {
        setStatusMessage(data.message ?? "Connecting...");
      }

      // If there's a QR, fetch it
      if (data.hasQR && data.qr) {
        setStep("qr");
        setQrDataUrl(data.qr);
      }
    } catch (err) {
      console.error("[WhatsApp] poll error:", err);
    }
  }, [workspaceId, clearPolling, onConnected]);

  // ── Start connection ────────────────────────────────────────────────────
  const startConnection = async () => {
    setStep("connecting");
    setStatusMessage("Starting WhatsApp...");
    setErrorMessage("");

    try {
      const res = await fetch(`/api/whatsapp/connect`, {
        method: "POST",
        headers: { "x-workspace-id": workspaceId },
      });
      const data = await res.json();

      if (!res.ok) {
        setStep("error");
        setErrorMessage(data.error ?? "Failed to start");
        return;
      }

      // If already connected
      if (data.status?.status === "connected") {
        setStep("connected");
        setStatusMessage(data.status.message);
        setTimeout(() => onConnected(), 1500);
        return;
      }

      // Start polling for QR and status
      const interval = setInterval(pollStatus, 1000);
      setPollingInterval(interval);
    } catch (err) {
      setStep("error");
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    }
  };

  // ── Disconnect ──────────────────────────────────────────────────────────
  const handleDisconnect = async () => {
    clearPolling();
    try {
      await fetch(`/api/whatsapp/disconnect`, {
        method: "POST",
        headers: { "x-workspace-id": workspaceId },
      });
    } catch (_) {}
    setStep("idle");
    setQrDataUrl(null);
    setStatusMessage("");
    setErrorMessage("");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => clearPolling();
  }, [clearPolling]);

  // ── QR code polling (separate endpoint for base64) ──────────────────────
  useEffect(() => {
    if (step !== "qr" && step !== "connecting") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/whatsapp/qr`, {
          headers: { "x-workspace-id": workspaceId },
        });
        const data = await res.json();
        if (data.hasQR && data.qr) {
          setQrDataUrl(data.qr);
          setStep("qr");
        }
      } catch (_) {}
    }, 1000);

    return () => clearInterval(interval);
  }, [step, workspaceId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1F5F9]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📱</span>
            <div>
              <h2 className="font-semibold text-[#0A0F1C]">WhatsApp</h2>
              <p className="text-xs text-[#64748B]">Scan with your phone</p>
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
        <div className="p-6">
          {/* ── Idle: show Connect button ── */}
          {step === "idle" && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mx-auto">
                <span className="text-3xl">📲</span>
              </div>
              <div>
                <h3 className="font-semibold text-[#0A0F1C] mb-1">Link WhatsApp</h3>
                <p className="text-sm text-[#64748B]">
                  Scan the QR code with your phone to connect your WhatsApp account.
                  No Meta Business account needed.
                </p>
              </div>
              <button
                onClick={startConnection}
                className="w-full py-3 rounded-xl bg-[#25D366] text-white font-semibold hover:bg-[#20BD5A] transition-colors"
              >
                Generate QR Code
              </button>
            </div>
          )}

          {/* ── Connecting ── */}
          {step === "connecting" && !qrDataUrl && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mx-auto animate-pulse">
                <span className="text-3xl">⏳</span>
              </div>
              <div>
                <h3 className="font-semibold text-[#0A0F1C] mb-1">Generating QR Code...</h3>
                <p className="text-sm text-[#64748B]">{statusMessage}</p>
              </div>
            </div>
          )}

          {/* ── QR Code ready ── */}
          {step === "qr" && qrDataUrl && (
            <div className="text-center space-y-4">
              <p className="text-sm font-medium text-[#0A0F1C]">Scan with your phone</p>
              <div className="relative mx-auto bg-white p-3 rounded-xl border border-[#E2E8F0] inline-block">
                {/* QR image */}
                <img
                  src={qrDataUrl}
                  alt="WhatsApp QR Code"
                  className="w-52 h-52 object-contain"
                />
                {/* Animated scan line overlay */}
                <div className="absolute inset-3 border-2 border-[#25D366]/30 rounded-lg pointer-events-none" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[#64748B]">
                  1. Open WhatsApp on your phone
                </p>
                <p className="text-xs text-[#64748B]">
                  2. Tap ⋮ → Linked Devices → Link a Device
                </p>
                <p className="text-xs text-[#64748B]">
                  3. Point your phone at this QR code
                </p>
              </div>
              {statusMessage && (
                <p className="text-xs text-[#25D366] font-medium animate-pulse">
                  {statusMessage}
                </p>
              )}
              <p className="text-xs text-[#94A3B8]">
                QR refreshes every 20 seconds — if it expires, reload and try again
              </p>
            </div>
          )}

          {/* ── Connected ── */}
          {step === "connected" && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mx-auto">
                <span className="text-3xl">✅</span>
              </div>
              <div>
                <h3 className="font-semibold text-[#0A0F1C] mb-1">Connected!</h3>
                <p className="text-sm text-[#64748B]">{statusMessage}</p>
              </div>
              <p className="text-xs text-[#94A3B8]">Redirecting...</p>
            </div>
          )}

          {/* ── Error ── */}
          {step === "error" && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
                <span className="text-3xl">❌</span>
              </div>
              <div>
                <h3 className="font-semibold text-[#0A0F1C] mb-1">Connection failed</h3>
                <p className="text-sm text-red-500">{errorMessage}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDisconnect}
                  className="flex-1 py-2.5 rounded-lg border border-[#E2E8F0] text-[#334155] text-sm font-medium hover:bg-[#F8FAFC]"
                >
                  Reset
                </button>
                <button
                  onClick={startConnection}
                  className="flex-1 py-2.5 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:bg-[#20BD5A]"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
