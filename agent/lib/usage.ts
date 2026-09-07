// SPDX-License-Identifier: MIT
import { prisma } from './db';

// ponytail: quét mọi session.ended trong ngày mỗi lần mở phiên (≤ vài trăm row/ngày); nếu chạy nhiều camera lâu dài thì gom vào một dòng đếm theo ngày.
export async function dailyTokensUsed(now = new Date()): Promise<number> {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const rows = await prisma.agentEvent.findMany({ where: { type: 'session.ended', emittedAt: { gte: start } }, select: { data: true } });
  // Một row data hỏng không được làm ngã phép đếm (và kéo theo cả phiên): bỏ qua row đó.
  return rows.reduce((sum, r) => {
    let u: { input_tokens?: number; output_tokens?: number };
    try { u = JSON.parse(r.data).usage ?? {}; } catch { return sum; }
    return sum + (u.input_tokens ?? 0) + (u.output_tokens ?? 0);
  }, 0);
}
