// SPDX-License-Identifier: MIT

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Client, Config } from "@libsql/client";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

// Thời gian driver chịu chờ khi file SQLite đang bị khoá (ms).
const BUSY_TIMEOUT_MS = 5000;

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

/** Dev dùng SQLite nhưng có NHIỀU tiến trình đụng vào cùng 1 file: Next.js API
 * (violations/alerts), agent worker (AgentEvent/AgentTask mỗi 20s) và AI engine
 * (đọc bảng Camera). Mặc định libsql mở DB ở chế độ rollback-journal với
 * busy_timeout = 0, nên chỉ cần một tiến trình khác đang đọc/ghi là lệnh ghi
 * văng ngay SQLITE_BUSY -> Prisma P1008 "SocketTimeout".
 *
 * Hai PRAGMA dưới đây xử lý đúng gốc: WAL cho phép đọc song song với ghi
 * (không còn reader chặn writer), busy_timeout bắt driver chờ tới lượt thay vì
 * bỏ cuộc tức thì. Client libsql bản local chạy đồng bộ nên 2 lệnh này áp dụng
 * xong ngay trên đúng connection mà Prisma sắp dùng, trước truy vấn đầu tiên. */
class PrismaLibSqlWal extends PrismaLibSql {
  createClient(config: Config): Client {
    const client = super.createClient(config);
    const warn = (e: unknown) => console.warn("[prisma] không đặt được PRAGMA SQLite:", e);
    // busy_timeout phải đặt TRƯỚC: chuyển sang WAL cần khoá độc quyền, nếu
    // driver không chịu chờ thì gặp reader đang mở là hỏng ngay.
    void client.execute(`PRAGMA busy_timeout=${BUSY_TIMEOUT_MS}`).catch(warn);
    void client.execute("PRAGMA journal_mode=WAL").catch(warn);
    return client;
  }
}

/** Postgres hay SQLite là do DATABASE_URL quyết định, không có biến cấu hình riêng:
 * `postgres://` / `postgresql://` -> PrismaPg (pool `pg`, nhiều tiến trình ghi song song
 * là chuyện bình thường), `file:` -> PrismaLibSqlWal như dev. Prisma 7 nhúng query
 * compiler theo provider của schema lúc `prisma generate`, nên bản dựng cho Postgres phải
 * chạy `npm run db:pg:generate` (schema prisma/postgres/schema.prisma) — xem wiki/03. */
export function createAdapter(url: string): PrismaLibSqlWal | PrismaPg {
  if (/^postgres(ql)?:\/\//.test(url)) return new PrismaPg({ connectionString: url });
  return new PrismaLibSqlWal({ url });
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({ adapter: createAdapter(resolveDbUrl()) });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
