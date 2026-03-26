import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import IntegrationsClient from "@/components/integrations/IntegrationsClient";
import type { Workspace, Integration } from "@/generated/prisma";

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
    include: { integrations: true },
  }) as (Workspace & { integrations: Integration[] }) | null;

  return (
    <IntegrationsClient
      workspace={workspace}
      session={session}
    />
  );
}
