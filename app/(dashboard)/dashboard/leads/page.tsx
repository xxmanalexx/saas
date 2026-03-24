import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function LeadsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
  });

  const leads = workspace
    ? await db.lead.findMany({
        where: { workspaceId: workspace.id },
        include: { contact: true, events: { orderBy: { createdAt: "desc" }, take: 3 } },
        orderBy: { score: "desc" },
        take: 100,
      })
    : [];

  const stages = ["QUALIFIED", "CONTACTED", "NEW", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#0A0F1C]">Lead Pipeline</h1>
        <span className="text-sm text-[#64748B]">{leads.length} leads</span>
      </div>

      {/* Stage summary */}
      <div className="grid grid-cols-7 gap-3 mb-6">
        {stages.map((stage) => {
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
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[#94A3B8]">
                  No leads yet — conversations will generate qualified leads automatically.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-[#0A0F1C]">
                      {(lead.contact.profile as Record<string, string>)?.name ?? lead.contact.channelIdentifier}
                    </div>
                    <div className="text-xs text-[#94A3B8]">{lead.contact.channelIdentifier}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">{lead.contact.channel}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            lead.score >= 60 ? "bg-[#00C853]" : lead.score >= 30 ? "bg-amber-400" : "bg-[#94A3B8]"
                          }`}
                          style={{ width: `${lead.score}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-[#334155]">{lead.score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      lead.stage === "QUALIFIED" ? "bg-[#00C853]/10 text-[#00C853]" :
                      lead.stage === "WON" ? "bg-blue-100 text-blue-600" :
                      lead.stage === "LOST" ? "bg-red-100 text-red-600" :
                      "bg-[#F1F5F9] text-[#64748B]"
                    }`}>{lead.stage}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">
                    {lead.events[0]
                      ? new Date(lead.events[0].createdAt).toLocaleDateString()
                      : "—"}
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
