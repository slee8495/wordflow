import NextAuth from "next-auth";
import type { DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

// Session strategy is JWT, not "database" — the adapter is still needed (it's what persists
// `users`/`accounts` rows so a signed-in Google identity maps to something profiles.userId can
// reference), but the session itself lives in a signed cookie rather than a DB row. No extra
// read on every request, and one less table that actually needs to work correctly.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [Google],
  session: { strategy: "jwt" },
  callbacks: {
    // Auth.js's default jwt callback already sets token.sub to the user's id on sign-in; this
    // just surfaces it on the session object so server code can read session.user.id directly
    // instead of re-deriving it.
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
