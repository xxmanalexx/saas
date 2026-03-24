import Link from "next/link";
import { auth } from "@/auth";

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#00C853] text-black font-bold text-lg flex items-center justify-center">
            R
          </div>
          <span className="font-semibold text-xl">Rana</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-sm text-white/60 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 rounded-lg bg-[#00C853] text-black text-sm font-semibold hover:bg-[#00E676] transition-colors"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-8 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00C853]/10 border border-[#00C853]/20 text-[#00C853] text-sm mb-8">
          <span className="w-2 h-2 rounded-full bg-[#00C853] animate-pulse" />
          Now serving businesses across MENA
        </div>
        <h1 className="text-5xl font-bold leading-tight max-w-3xl mx-auto mb-6">
          Your AI employee that<br />
          <span className="text-[#00C853]">never sleeps, never forgets</span>
        </h1>
        <p className="text-lg text-white/50 max-w-xl mx-auto mb-10">
          Automate every customer conversation across WhatsApp, Instagram, web chat, and email.
          Qualify leads, book appointments, and handle support — while you focus on growing your business.
        </p>
        <div className="flex items-center gap-4 justify-center">
          <Link
            href="/signup"
            className="px-8 py-4 rounded-xl bg-[#00C853] text-black font-semibold text-lg hover:bg-[#00E676] transition-colors"
          >
            Start free — no credit card
          </Link>
          <Link
            href="/login"
            className="px-8 py-4 rounded-xl border border-white/20 text-white/80 font-medium text-lg hover:bg-white/5 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-8 py-20 border-t border-white/10">
        <h2 className="text-center text-3xl font-bold mb-16">Everything your business needs</h2>
        <div className="grid grid-cols-3 gap-8">
          {[
            {
              icon: "💬",
              title: "Omnichannel conversations",
              desc: "One AI agent handles WhatsApp, Instagram DMs, web chat, and email — unified in a single dashboard.",
            },
            {
              icon: "🎯",
              title: "Lead qualification",
              desc: "Automatically score and qualify every lead. Know who's ready to buy and who needs nurturing.",
            },
            {
              icon: "📅",
              title: "Smart booking",
              desc: "Connect to Cal.com or Google Calendar. Let customers book without any back-and-forth.",
            },
            {
              icon: "📊",
              title: "CRM integration",
              desc: "HubSpot, Zoho, Pipedrive — every conversation, lead, and deal flows directly into your CRM.",
            },
            {
              icon: "🔄",
              title: "Smart follow-ups",
              desc: "Cold leads get automatically re-engaged. Never lose a prospect to silence again.",
            },
            {
              icon: "🛡️",
              title: "Human escalation",
              desc: "Negative sentiment, complaints, or explicit requests — instantly flagged and escalated to you.",
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-[#00C853]/30 transition-colors">
              <span className="text-3xl mb-4 block">{icon}</span>
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-7xl mx-auto px-8 py-20 border-t border-white/10" id="pricing">
        <h2 className="text-center text-3xl font-bold mb-4">Simple, transparent pricing</h2>
        <p className="text-center text-white/50 mb-12">Start free. Scale when you're ready.</p>
        <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { name: "Starter", price: "$49", features: ["1,000 conversations/mo", "500 leads", "3 integrations", "Lead qualification agent"] },
            { name: "Growth", price: "$149", highlight: true, features: ["10,000 conversations/mo", "5,000 leads", "10 integrations", "All agents + booking"] },
            { name: "Enterprise", price: "$499", features: ["Unlimited conversations", "Unlimited leads", "Unlimited integrations", "Priority support + SLA"] },
          ].map(({ name, price, highlight, features }) => (
            <div key={name} className={`p-8 rounded-2xl border ${highlight ? "bg-[#00C853]/5 border-[#00C853]/40" : "bg-white/5 border-white/10"}`}>
              {highlight && <span className="text-xs text-[#00C853] font-medium mb-3 block">Most popular</span>}
              <h3 className="text-xl font-bold mb-1">{name}</h3>
              <div className="text-4xl font-bold mb-6">{price}<span className="text-lg text-white/40">/mo</span></div>
              <ul className="space-y-2 mb-8">
                {features.map((f) => (
                  <li key={f} className="text-sm text-white/60 flex items-center gap-2">
                    <span className="text-[#00C853]">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className={`block text-center py-3 rounded-lg font-medium transition-colors ${highlight ? "bg-[#00C853] text-black hover:bg-[#00E676]" : "border border-white/20 hover:bg-white/5"}`}>
                Get started
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-8 py-10 border-t border-white/10 text-center text-white/30 text-sm">
        © 2026 Rana AI — Built for MENA businesses 🦾
      </footer>
    </div>
  );
}
