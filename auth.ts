import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
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
        const defaultPersona = await db.agentPersona.create({
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
