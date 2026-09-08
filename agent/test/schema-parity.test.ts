// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// prisma/postgres/schema.prisma là BẢN SAO của prisma/schema.prisma, chỉ khác dòng
// `provider` của datasource. Hai file lệch nhau = client sinh cho Postgres có kiểu khác
// bản dev, lỗi chỉ lộ ra khi deploy. Test này bắt lệch ngay lúc sửa schema.
// Chuẩn hoá: bỏ dòng chỉ có chú thích và dòng trống, đổi provider về một giá trị chung.
function normalize(file: string): string[] {
  return readFileSync(path.resolve(process.cwd(), file), 'utf8')
    .split('\n')
    .map(line => line.replace(/provider = "(sqlite|postgresql)"/, 'provider = "<db>"').trimEnd())
    .filter(line => line.trim() !== '' && !line.trim().startsWith('//'));
}

test('the PostgreSQL schema matches the SQLite schema except for the datasource provider', () => {
  const sqlite = normalize('prisma/schema.prisma');
  const postgres = normalize('prisma/postgres/schema.prisma');
  assert.deepEqual(postgres, sqlite);
  assert.ok(sqlite.length > 100, 'đọc hụt schema?');
});

test('each schema declares its own datasource provider', () => {
  const raw = (f: string) => readFileSync(path.resolve(process.cwd(), f), 'utf8');
  assert.match(raw('prisma/schema.prisma'), /provider = "sqlite"/);
  assert.match(raw('prisma/postgres/schema.prisma'), /provider = "postgresql"/);
  assert.doesNotMatch(raw('prisma/postgres/schema.prisma'), /provider = "sqlite"/);
});
