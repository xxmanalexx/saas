import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ leads: [] });

  const leads = await db.lead.findMany({
    where: { workspaceId: workspace.id },
    include: { contact: true, events: { orderBy: { createdAt: "desc" }, take: 5 } },
    orderBy: { score: "desc" },
    take: 100,
  });

  return NextResponse.json({ leads });
}
