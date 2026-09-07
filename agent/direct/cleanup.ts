// SPDX-License-Identifier: MIT
import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../lib/env';
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import { checkPaused } from '../lib/guard';
import type { LeasedTask } from '../lib/tasks';

const DAY = 86_400_000;
export const KEEP_DAYS = 30;

// Thuần: chọn file xoá tới khi giải phóng đủ targetBytes. Chỉ file > 30 ngày VÀ đã có Violation tham chiếu
// (ảnh chưa tham chiếu có thể đang được ghi; ảnh < 24h là bằng chứng mới, không bao giờ đụng).
export function pickCleanup(files: { name: string; mtimeMs: number; referenced: boolean }[], now: number, targetBytes: number, sizes: Record<string, number>): string[] {
  const eligible = files
    .filter(f => f.referenced && now - f.mtimeMs > KEEP_DAYS * DAY && now - f.mtimeMs > DAY)
    .sort((a, b) => a.mtimeMs - b.mtimeMs);
  const out: string[] = []; let freed = 0;
  for (const f of eligible) { if (freed >= targetBytes) break; out.push(f.name); freed += sizes[f.name] ?? 0; }
  return out;
}

export async function runCleanup(task: LeasedTask, sessionId: string): Promise<string> {
  // Xoá ảnh là hành động không hoàn tác được: tạm dừng thì chỉ ghi nhận, không đụng đĩa.
  const paused = await checkPaused();
  if (paused) {
    await emit({ sessionId, taskId: task.id, subjectType: 'system', type: 'action', data: { action: 'snapshot.cleanup', skipped: true, reason: paused.reason } });
    return 'tạm dừng — không xoá ảnh';
  }
  const names = (await readdir(env.snapshotDir)).filter(n => n.startsWith('violation_') && n.endsWith('.jpg'));
  const urls = names.map(n => `/snapshots/${n}`);
  const referenced = new Set((await prisma.violation.findMany({ where: { snapshotUrl: { in: urls } }, select: { snapshotUrl: true } })).map(v => path.basename(v.snapshotUrl)));
  const files = []; const sizes: Record<string, number> = {};
  for (const name of names) { const s = await stat(path.join(env.snapshotDir, name)); files.push({ name, mtimeMs: s.mtimeMs, referenced: referenced.has(name) }); sizes[name] = s.size; }
  const total = Object.values(sizes).reduce((a, b) => a + b, 0);
  const target = Math.max(0, total - env.snapshotMaxMb * 1024 * 1024 * 0.8);
  const picked = pickCleanup(files, Date.now(), target, sizes);
  for (const name of picked) { try { await unlink(path.join(env.snapshotDir, name)); } catch { /* đã mất thì thôi */ } }
  await emit({ sessionId, taskId: task.id, subjectType: 'system', type: 'action', data: { action: 'snapshot.cleanup', deleted: picked.length, freedBytes: picked.reduce((a, n) => a + (sizes[n] ?? 0), 0) } });
  return `đã xoá ${picked.length} ảnh`;
}
