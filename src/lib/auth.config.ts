import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible auth config (no Node.js modules like bcryptjs).
 * Used by middleware for session checking.
 */
export const authConfig: NextAuthConfig = {
  providers: [], // Providers added in auth.ts (Node.js only)
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/login";
      const isAuthApi = nextUrl.pathname.startsWith("/api/auth");

      if (isAuthApi || isLoginPage) return true;
      if (!isLoggedIn) return false;
      return true;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
