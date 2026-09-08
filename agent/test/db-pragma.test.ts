// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';

// Dev chạy nhiều tiến trình ghi cùng file SQLite; thiếu WAL + busy_timeout là
// lệnh ghi văng P1008 (SQLITE_BUSY) ngay khi có tiến trình khác đang đọc.
test('shared prisma client opens SQLite in WAL mode with a busy timeout', async () => {
  const [journal] = await prisma.$queryRawUnsafe<{ journal_mode: string }[]>('PRAGMA journal_mode');
  assert.equal(journal.journal_mode.toLowerCase(), 'wal');

  const [busy] = await prisma.$queryRawUnsafe<{ timeout: number }[]>('PRAGMA busy_timeout');
  assert.ok(busy.timeout >= 5000, `busy_timeout quá thấp: ${busy.timeout}`);
});
