// SPDX-License-Identifier: MIT
import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../lib/env';
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import { checkPaused } from '../lib/guard';
import type { LeasedTask } from '../lib/tasks';

const DAY = 86_400_000;
const CLOSED = new Set(['RESOLVED', 'FALSE_POSITIVE']);

// Bằng chứng của một vi phạm gồm ảnh chốt (violation_*.jpg) và clip ngắn (clip_*.mp4)
// do yolo_inference.py ghi. Mọi tệp khác trong thư mục snapshots (preview_*.jpg cho trình vẽ
// vùng, .heartbeat.json) KHÔNG phải bằng chứng và cleanup không được đụng vào.
export function isEvidenceFile(name: string): boolean {
  return (name.startsWith('violation_') && name.endsWith('.jpg'))
    || (name.startsWith('clip_') && name.endsWith('.mp4'));
}

// Thuần: chọn file xoá tới khi giải phóng đủ targetBytes. Ba điều kiện cùng lúc:
// - đã có Violation tham chiếu (tệp chưa tham chiếu có thể đang được ghi),
// - vi phạm đó đã ĐÓNG (RESOLVED/FALSE_POSITIVE) — ảnh của vi phạm còn OPEN/UNDER_REVIEW là bằng
//   chứng của hồ sơ chưa xử lý xong, không được xoá dù đĩa đầy,
// - cũ hơn 24h (bằng chứng mới, không bao giờ đụng).
// Không giữ thêm theo tuổi (từng là 30 ngày): yolo_inference.py xoá sạch violation_*.jpg mỗi
// lần engine khởi động nên ảnh không bao giờ sống đủ 30 ngày — luật đó khiến cleanup luôn xoá 0
// file và disk.pressure lặp lại mỗi sweep.
export function pickCleanup(files: { name: string; mtimeMs: number; referenced: boolean; closed: boolean }[], now: number, targetBytes: number, sizes: Record<string, number>): string[] {
  const eligible = files
    .filter(f => f.referenced && f.closed && now - f.mtimeMs > DAY)
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
  const names = (await readdir(env.snapshotDir)).filter(isEvidenceFile);
  const urls = names.map(n => `/snapshots/${n}`);
  // status: row cũ có thể ghi chữ thường (seed() đã nắn, nhưng so sánh vẫn không phân biệt hoa/thường).
  const rows = await prisma.violation.findMany({ where: { OR: [{ snapshotUrl: { in: urls } }, { clipUrl: { in: urls } }] }, select: { snapshotUrl: true, clipUrl: true, status: true } });
  // Ảnh và clip của cùng một vi phạm sống/chết cùng nhau: cả hai đều là bằng chứng của hồ sơ đó.
  const closedByFile = new Map<string, boolean>();
  for (const v of rows) {
    const closed = CLOSED.has(v.status.toUpperCase());
    closedByFile.set(path.basename(v.snapshotUrl), closed);
    if (v.clipUrl) closedByFile.set(path.basename(v.clipUrl), closed);
  }
  const files = []; const sizes: Record<string, number> = {};
  for (const name of names) { const s = await stat(path.join(env.snapshotDir, name)); files.push({ name, mtimeMs: s.mtimeMs, referenced: closedByFile.has(name), closed: closedByFile.get(name) === true }); sizes[name] = s.size; }
  const total = Object.values(sizes).reduce((a, b) => a + b, 0);
  const target = Math.max(0, total - env.snapshotMaxMb * 1024 * 1024 * 0.8);
  const picked = pickCleanup(files, Date.now(), target, sizes);
  for (const name of picked) { try { await unlink(path.join(env.snapshotDir, name)); } catch { /* đã mất thì thôi */ } }
  await emit({ sessionId, taskId: task.id, subjectType: 'system', type: 'action', data: { action: 'snapshot.cleanup', deleted: picked.length, freedBytes: picked.reduce((a, n) => a + (sizes[n] ?? 0), 0) } });
  return `đã xoá ${picked.length} tệp bằng chứng`;
}
