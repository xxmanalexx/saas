import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function ConversationsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Get first workspace for demo
  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
  });

  const conversations = workspace
    ? await db.conversation.findMany({
        where: { workspaceId: workspace.id },
        include: {
          contact: true,
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      })
    : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#0A0F1C]">Conversations</h1>
        <span className="text-sm text-[#64748B]">{conversations.length} total</span>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase tracking-wide">Channel</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase tracking-wide">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase tracking-wide">Last message</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase tracking-wide">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {conversations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[#94A3B8]">
                  No conversations yet — connect a channel to start receiving messages.
                </td>
              </tr>
            ) : (
              conversations.map((conv) => (
                <tr key={conv.id} className="hover:bg-[#F8FAFC] transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-[#F1F5F9] text-[#334155]">
                      {conv.channel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-[#0A0F1C]">
                      {(conv.contact?.profile as Record<string, string>)?.name ?? conv.contact?.channelIdentifier ?? "—"}
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
