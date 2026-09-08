// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { createAdapter } from '@/lib/prisma';

// Dev chạy nhiều tiến trình ghi cùng file SQLite; thiếu WAL + busy_timeout là
// lệnh ghi văng P1008 (SQLITE_BUSY) ngay khi có tiến trình khác đang đọc.
test('shared prisma client opens SQLite in WAL mode with a busy timeout', async () => {
  const [journal] = await prisma.$queryRawUnsafe<{ journal_mode: string }[]>('PRAGMA journal_mode');
  assert.equal(journal.journal_mode.toLowerCase(), 'wal');

  const [busy] = await prisma.$queryRawUnsafe<{ timeout: number }[]>('PRAGMA busy_timeout');
  assert.ok(busy.timeout >= 5000, `busy_timeout quá thấp: ${busy.timeout}`);
});

// Cùng một mã nguồn chạy được cả SQLite (dev) lẫn PostgreSQL (production): chọn adapter
// theo lược đồ của DATABASE_URL. Chỉ dựng adapter, không mở kết nối tới Postgres.
test('createAdapter picks PrismaPg for postgres URLs and libsql otherwise', () => {
  assert.equal(createAdapter('postgresql://u:p@db:5432/safesight').provider, 'postgres');
  assert.equal(createAdapter('postgres://u:p@db:5432/safesight').provider, 'postgres');
  const sqlite = createAdapter('file:///tmp/dev.db');
  assert.equal(sqlite.provider, 'sqlite');
  assert.equal(sqlite.constructor.name, 'PrismaLibSqlWal'); // vẫn là bản có PRAGMA WAL
});
