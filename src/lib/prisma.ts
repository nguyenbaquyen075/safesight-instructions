// SPDX-License-Identifier: MIT

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function resolveDbUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");

  if (raw.startsWith("file:")) {
    const filePath = raw.replace(/^file:(\.\/)?/, "");
    const absPath = path.resolve(process.cwd(), filePath);
    return `file://${absPath}`;
  }
  return raw;
}

function createPrismaClient(): PrismaClient {
  const url = resolveDbUrl();
  const adapter = new PrismaLibSql({ url });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
