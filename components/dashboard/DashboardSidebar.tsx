"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Users,
  TrendingUp,
  Plug,
  Settings,
  BarChart3,
  Zap,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: BarChart3 },
  { href: "/dashboard/conversations", label: "Conversations", icon: MessageSquare },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/analytics", label: "Analytics", icon: TrendingUp },
  { href: "/dashboard/integrations", label: "Integrations", icon: Plug },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardSidebar({
  className,
}: {
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "flex flex-col w-64 min-h-screen bg-[#0A0F1C] text-white",
        className
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#00C853] text-black font-bold text-lg">
          R
        </div>
        <div>
          <div className="font-semibold text-base">Rana</div>
          <div className="text-xs text-white/40">AI Agent Platform</div>
        </div>
      </div>

      {/* Status pill */}
      <div className="mx-4 mt-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#00C853]/10 border border-[#00C853]/20">
        <span className="w-2 h-2 rounded-full bg-[#00C853] animate-pulse" />
        <span className="text-xs text-[#00C853] font-medium">All systems operational</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-2 text-xs text-white/30">
          <Zap className="w-3 h-3" />
          <span>Running on Next.js + Prisma</span>
        </div>
      </div>
    </aside>
  );
}
