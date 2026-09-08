// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// scripts/sqlite-to-postgres.mjs chép dữ liệu theo một danh sách bảng viết tay. Quên một
// model = dữ liệu bảng đó biến mất im lặng khi chuyển sang Postgres, chỉ lộ ra lúc dùng thật.
// Test này đọc danh sách từ chính file script (không import: file tự chạy main() khi nạp).
const read = (file: string) => readFileSync(path.resolve(process.cwd(), file), 'utf8');

function migratedTables(): string[] {
  const block = read('scripts/sqlite-to-postgres.mjs').match(/const TABLES = \[([\s\S]*?)\n\];/);
  assert.ok(block, 'không tìm thấy khai báo TABLES trong script chuyển dữ liệu');
  return [...block[1].matchAll(/\['(\w+)',\s*'(\w+)'\]/g)].map(m => m[1]);
}

test('the SQLite to PostgreSQL script copies every model declared in the Prisma schema', () => {
  const models = [...read('prisma/schema.prisma').matchAll(/^model (\w+) \{/gm)].map(m => m[1]);
  const tables = migratedTables();
  assert.ok(models.length > 10, 'đọc hụt schema?');
  assert.deepEqual(models.filter(m => !tables.includes(m)), [], 'model thiếu trong TABLES sẽ không được chép sang Postgres');
});

test('the migration script lists CorrectiveAction after its parent Violation', () => {
  const tables = migratedTables();
  assert.ok(tables.includes('CorrectiveAction'));
  // Khoá ngoại CorrectiveAction.violationId: chép trước Violation là vi phạm ràng buộc.
  assert.ok(tables.indexOf('CorrectiveAction') > tables.indexOf('Violation'));
});
