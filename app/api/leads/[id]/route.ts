import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * PATCH /api/leads/[id]
 * Update a lead's stage (e.g. WON, LOST, QUALIFIED, etc.)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { stage } = body;

  const validStages = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];
  if (!validStages.includes(stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const lead = await db.lead.findUnique({ where: { id }, include: { contact: true } });
  if (!lead || lead.workspaceId !== workspace.id) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const updated = await db.lead.update({
    where: { id },
    data: {
      stage,
      // If marking WON or LOST, update score accordingly
      score: stage === "WON" ? 100 : stage === "LOST" ? 0 : lead.score,
    },
  });

  await db.leadEvent.create({
    data: {
      leadId: lead.id,
      type: "stage_change",
      data: JSON.stringify({ from: lead.stage, to: stage }),
    },
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/leads/[id]
 * Delete a lead and its associated events.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead || lead.workspaceId !== workspace.id) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  await db.leadEvent.deleteMany({ where: { leadId: id } });
  await db.lead.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
