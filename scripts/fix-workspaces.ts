/**
 * One-time migration: create workspaces for any users who don't have one.
 * Run: npx tsx scripts/fix-workspaces.ts
 */
import { db } from "@/lib/db";

async function main() {
  const usersWithoutWorkspace = await db.user.findMany({
    where: { workspaces: { none: {} } },
  });

  console.log(`Found ${usersWithoutWorkspace.length} users without workspaces`);

  for (const user of usersWithoutWorkspace) {
    await db.workspace.create({
      data: {
        name: "My Workspace",
        userId: user.id,
      },
    });
    console.log(`Created workspace for user ${user.email ?? user.id}`);
  }

  console.log("Done!");
}

main();
