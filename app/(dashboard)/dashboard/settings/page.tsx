import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PLANS } from "@/lib/stripe";

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
  });

  const user = await db.user.findUnique({ where: { id: session.user.id } });

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold text-[#0A0F1C]">Settings</h1>

      {/* Profile */}
      <section className="bg-white rounded-xl border border-[#E2E8F0] p-6">
        <h2 className="font-semibold text-[#0A0F1C] mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-[#64748B] mb-1 block">Name</label>
            <input
              type="text"
              defaultValue={user?.name ?? ""}
              className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] text-[#0A0F1C] focus:outline-none focus:border-[#00C853]"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="text-sm text-[#64748B] mb-1 block">Email</label>
            <input
              type="email"
              defaultValue={user?.email ?? ""}
              disabled
              className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8]"
            />
          </div>
          <button className="px-6 py-2.5 rounded-lg bg-[#00C853] text-black font-medium hover:bg-[#00E676] transition-colors">
            Save changes
          </button>
        </div>
      </section>

      {/* Workspace */}
      <section className="bg-white rounded-xl border border-[#E2E8F0] p-6">
        <h2 className="font-semibold text-[#0A0F1C] mb-4">Workspace</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-[#64748B] mb-1 block">Workspace name</label>
            <input
              type="text"
              defaultValue={workspace?.name ?? ""}
              className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] text-[#0A0F1C] focus:outline-none focus:border-[#00C853]"
              placeholder="My Business"
            />
          </div>
          <button className="px-6 py-2.5 rounded-lg bg-[#00C853] text-black font-medium hover:bg-[#00E676] transition-colors">
            Update workspace
          </button>
        </div>
      </section>

      {/* Plan */}
      <section className="bg-white rounded-xl border border-[#E2E8F0] p-6">
        <h2 className="font-semibold text-[#0A0F1C] mb-1">Plan & Billing</h2>
        <p className="text-sm text-[#64748B] mb-4">
          Current plan: <span className="font-medium text-[#0A0F1C]">{user?.plan ?? "FREE"}</span>
        </p>
        <div className="space-y-3">
          {Object.entries(PLANS)
            .filter(([, p]) => p.price > 0)
            .map(([key, plan]) => (
              <div
                key={key}
                className="flex items-center justify-between p-4 rounded-lg border border-[#E2E8F0] hover:border-[#00C853]/40 transition-colors"
              >
                <div>
                  <div className="font-medium text-[#0A0F1C]">{plan.name} — ${plan.price}/mo</div>
                  <div className="text-xs text-[#64748B] mt-0.5">
                    {plan.limits.conversations.toLocaleString()} conversations, {plan.limits.leads.toLocaleString()} leads
                  </div>
                </div>
                <button
                  data-plan={plan.priceId}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    user?.plan === key
                      ? "bg-[#00C853]/10 text-[#00C853] cursor-default"
                      : "bg-[#0A0F1C] text-white hover:bg-[#1A1F2E]"
                  }`}
                  disabled={user?.plan === key}
                >
                  {user?.plan === key ? "Current" : "Upgrade"}
                </button>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
