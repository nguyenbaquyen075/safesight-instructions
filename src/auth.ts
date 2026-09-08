// SPDX-License-Identifier: MIT

import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { UserRole } from "@/types/enums";

function devLoginAllowed(): boolean {
  if (process.env.ALLOW_DEV_LOGIN === "true") return true;
  return process.env.NODE_ENV !== "production";
}

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

          // Tài khoản dev cứng: chỉ mở ngoài production, hoặc khi cố ý bật ALLOW_DEV_LOGIN=true.
          // Production phải đăng nhập bằng User trong DB (npm run db:seed tạo admin thật).
          if (devLoginAllowed() && email === "admin@safesight.ai" && password === "password123") {
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
                // DB lưu role chữ HOA (default "SAFETY_OFFICER" trong schema.prisma) còn enum UserRole chữ thường:
                // chuẩn hoá ngay khi đăng nhập để PAGE_ROLES và ORG_WIDE_ROLES so sánh đúng.
                role: (user.role as string).toLowerCase() as UserRole,
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
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.role = token.role as UserRole;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
