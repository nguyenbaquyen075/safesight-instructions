// SPDX-License-Identifier: MIT

import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { UserRole } from "@/types/enums";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const parsed = z
            .object({ email: z.string().email(), password: z.string().min(6) })
            .safeParse(credentials);

          if (!parsed.success) return null;

          const { email, password } = parsed.data;

          // Hardcoded test account
          if (email === "admin@safesight.ai" && password === "password123") {
            return {
              id: "user-005",
              name: "SafeSight Admin",
              email: "admin@safesight.ai",
              role: UserRole.SUPER_ADMIN,
            };
          }

          // Query from SQLite database
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user) return null;

          if (user.passwordHash) {
            const match = await bcrypt.compare(password, user.passwordHash);
            if (match) {
              return {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role as string as UserRole,
              };
            }
          }
          return null;
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).role = token.role as string;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
