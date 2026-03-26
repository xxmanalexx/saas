import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db, getPrismaDb } from "@/lib/db";
import type { PrismaClient } from "@prisma/client";

// Use NEXTAUTH_SECRET env var, or fall back to a dev-only value with a warning
function getSecret(): string {
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXTAUTH_SECRET environment variable is required in production.");
  }
  console.warn("[auth] WARNING: NEXTAUTH_SECRET not set. Using a temporary dev secret. Set it in .env for production.");
  return "dev-only-temp-secret-do-not-use-in-production";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: getSecret(),
  adapter: PrismaAdapter(getPrismaDb() as PrismaClient),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        (session.user as { id?: string }).id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  events: {
    async createUser({ user }) {
      // Auto-create a default workspace + default "Rana" persona for new users
      if (user.id) {
        const workspace = await db.workspace.create({
          data: {
            name: "My Workspace",
            userId: user.id,
          },
        });

        // Seed default persona so agents always have personaContext
        await db.agentPersona.create({
          data: {
            workspaceId: workspace.id,
            name: "Rana",
            role: "RECEPTIONIST",
            tone: "FRIENDLY",
            language: "en",
            emojiStyle: "SOMETIMES",
            instructions:
              "You are a proactive AI employee, not a chatbot. " +
              "You sound confident, warm, and helpful — like someone who genuinely cares about the customer's business. " +
              "You never sound robotic or overly formal. You take ownership of tasks and follow through.",
            isDefault: true,
          },
        });
      }
    },
  },
});
