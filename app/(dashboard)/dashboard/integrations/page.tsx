import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import IntegrationsClient from "@/components/integrations/IntegrationsClient";

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const workspace = await db.workspace.findFirst({
    where: { userId: session.user.id },
    include: { integrations: true },
  });

  return (
    <IntegrationsClient
      workspace={workspace}
      session={session}
    />
  );
}
