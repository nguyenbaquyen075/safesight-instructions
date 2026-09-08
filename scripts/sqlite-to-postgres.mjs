// SPDX-License-Identifier: MIT

// Chép dữ liệu từ SQLite (dev.db) sang PostgreSQL, chạy MỘT LẦN khi chuyển môi trường.
//
//   SQLITE_URL=file:./data/dev.db POSTGRES_URL=postgresql://... npm run db:pg:migrate-data
//
// Thứ tự chạy đúng (xem wiki/03): `npm run db:pg:push` tạo bảng bên Postgres -> script này
// -> `npm run db:pg:generate` đổi Prisma Client sang bản Postgres. Phải chạy TRƯỚC bước
// generate vì script đọc SQLite bằng chính Prisma Client mặc định (sinh từ schema sqlite):
// Prisma 7 nhúng query compiler theo provider nên một client chỉ nói được một thứ tiếng.
// Bên Postgres ghi bằng `pg` thô — kiểu JS mà Prisma trả về (Date, boolean, number, null)
// được driver `pg` chuyển đúng sang timestamp/boolean/numeric.
//
// Chạy lại được: mọi INSERT đều `ON CONFLICT DO NOTHING`, id giữ nguyên nên không nhân đôi.
import 'dotenv/config';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import pg from 'pg';

// Thứ tự khoá ngoại: bảng cha trước bảng con. Sai thứ tự là violates foreign key.
const TABLES = [
  ['Organization', 'organization'],
  ['Site', 'site'],
  ['Camera', 'camera'],
  ['Zone', 'zone'],
  ['Violation', 'violation'],
  ['ObservationStat', 'observationStat'],
  ['User', 'user'],
  ['AlertRule', 'alertRule'],
  ['Alert', 'alert'], // sau Violation, AlertRule và User (acknowledgedById)
  ['AuditLog', 'auditLog'],
  ['TelegramSettings', 'telegramSettings'],
  ['ZaloSettings', 'zaloSettings'],
  ['AgentTask', 'agentTask'],
  ['AgentEvent', 'agentEvent'],
  ['AgentSettings', 'agentSettings'],
  ['CameraAgent', 'cameraAgent'],
];

// ponytail: đọc/ghi từng lô 500 dòng — đủ nhanh cho vài trăm nghìn dòng và giữ số tham số
// của một câu INSERT dưới trần 65535 của Postgres. Cần nhanh hơn nữa thì dùng COPY.
const CHUNK = 500;

function sqliteUrl() {
  const raw = process.env.SQLITE_URL ?? process.env.DATABASE_URL;
  if (!raw?.startsWith('file:')) throw new Error('SQLITE_URL phải là đường dẫn file: (ví dụ file:./data/dev.db)');
  return `file://${path.resolve(process.cwd(), raw.replace(/^file:(\.\/)?/, ''))}`;
}

async function copyTable(prisma, client, table, delegate) {
  let copied = 0;
  for (let skip = 0; ; skip += CHUNK) {
    const rows = await prisma[delegate].findMany({ take: CHUNK, skip, orderBy: { id: 'asc' } });
    if (rows.length === 0) break;
    const cols = Object.keys(rows[0]);
    const placeholders = rows
      .map((_, r) => `(${cols.map((_, c) => `$${r * cols.length + c + 1}`).join(',')})`)
      .join(',');
    await client.query(
      `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(',')}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
      rows.flatMap(row => cols.map(c => row[c])),
    );
    copied += rows.length;
    if (rows.length < CHUNK) break;
  }
  return copied;
}

async function main() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) throw new Error('POSTGRES_URL chưa được đặt');

  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: sqliteUrl() }) });
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    for (const [table, delegate] of TABLES) {
      const copied = await copyTable(prisma, client, table, delegate);
      console.log(`${table}: ${copied} dòng`);
    }
  } finally {
    await client.end();
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
