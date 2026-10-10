import "server-only";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { passwordMatches } from "./server/password";
export const { handlers, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  providers: [Credentials({
    credentials: { password: { label: "Family password", type: "password" } },
    authorize(credentials) {
      if (!process.env.AUTH_SECRET || !passwordMatches(credentials.password, process.env.FAMILY_PASSWORD)) return null;
      return { id: "family", name: "Family member" };
    },
  })],
});
