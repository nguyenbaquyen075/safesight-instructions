// SPDX-License-Identifier: MIT
import { prisma } from './db';
import { cameraIdOf } from './camera-agent';

export type Lane = 'direct' | 'research';

export const DIRECT_KINDS = ['health.sweep', 'health.probe', 'snapshot.cleanup'] as const;
export const RESEARCH_KINDS = ['ask', 'violation.review', 'ops.escalate', 'shift.report', 'camera.digest', 'followup'] as const;
export const KINDS = [...DIRECT_KINDS, ...RESEARCH_KINDS] as const;
export type TaskKind = (typeof KINDS)[number];

export const PRIORITY = {
  'health.sweep': 900, 'health.probe': 800, 'ask': 500, 'violation.review': 300,
  'ops.escalate': 250, 'shift.report': 200, 'snapshot.cleanup': 100, 'camera.digest': 50, 'followup': 0,
} as const satisfies Record<TaskKind, number>;

export const MAX_ATTEMPTS = 3;
export const LEASE_MS = 10 * 60_000;
export const RETIRED_OUTCOME = `Bỏ sau ${MAX_ATTEMPTS} lần: phiên không báo cáo lại.`;

export interface LeasedTask {
  id: string; kind: string; subjectType: string | null; subjectId: string | null;
  reason: string; budget: number; attempts: number; priority: number; dueAt: Date;
  // Chỉ có khi task đã từng chạy một phiên (vd. task 'ask' nối lại thread cũ) — dùng để gắn event lỗi vào đúng thread thay vì phiên mới.
  sessionId?: string | null;
}

export function laneOf(kind: string): Lane {
  return (DIRECT_KINDS as readonly string[]).includes(kind) ? 'direct' : 'research';
}

export async function scheduleTask(input: {
  kind: string; subjectType?: string | null; subjectId?: string | null;
  reason: string; dueAt: Date; priority?: number; budget?: number;
}, opts: { excludeId?: string } = {}): Promise<{ id: string; merged: boolean }> {
  const existing = await prisma.agentTask.findFirst({
    where: {
      kind: input.kind, finishedAt: null, subjectType: input.subjectType ?? null, subjectId: input.subjectId ?? null,
      // Task đang chạy (còn lease) không bao giờ là đích gộp — nếu gộp vào nó, completeTask sẽ đóng luôn lần hẹn sau.
      OR: [{ leasedUntil: null }, { leasedUntil: { lt: new Date() } }],
      // excludeId: task đang chạy tự hẹn lần sau không được gộp vào chính nó (nếu không completeTask sẽ đóng luôn lần sau).
      ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    await prisma.agentTask.update({ where: { id: existing.id }, data: { dueAt: input.dueAt, reason: input.reason } });
    return { id: existing.id, merged: true };
  }
  const created = await prisma.agentTask.create({
    data: {
      kind: input.kind, subjectType: input.subjectType ?? null, subjectId: input.subjectId ?? null,
      reason: input.reason, dueAt: input.dueAt,
      priority: input.priority ?? (PRIORITY as Record<string, number>)[input.kind] ?? 0,
      budget: input.budget ?? 6,
    },
    select: { id: true },
  });
  return { id: created.id, merged: false };
}

// Lưới an toàn: chỉ tạo khi chưa có task đang chờ; KHÔNG kéo dueAt của task đang chờ về sớm hơn.
export async function ensureTask(input: {
  kind: string; subjectType?: string | null; subjectId?: string | null;
  reason: string; dueAt: Date; priority?: number; budget?: number;
}): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.agentTask.findFirst({
    where: { kind: input.kind, finishedAt: null, subjectType: input.subjectType ?? null, subjectId: input.subjectId ?? null },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };
  const created = await prisma.agentTask.create({
    data: {
      kind: input.kind, subjectType: input.subjectType ?? null, subjectId: input.subjectId ?? null,
      reason: input.reason, dueAt: input.dueAt,
      priority: input.priority ?? (PRIORITY as Record<string, number>)[input.kind] ?? 0,
      budget: input.budget ?? 6,
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

// ponytail: SQLite không có FOR UPDATE SKIP LOCKED — thiết kế cho MỘT worker.
// Nhiều worker/Postgres thì thay bằng UPDATE ... FROM (SELECT ... FOR UPDATE SKIP LOCKED) như CRM lib/tasks.ts.
// opts.onePerCamera: mỗi lượt chỉ nhận MỘT task cho mỗi camera — subagent của một camera không
// chạy hai phiên song song với chính nó; task thứ hai của camera đó chờ lượt sau.
export async function claimDue(limit: number, lane: Lane, now = new Date(), opts: { onePerCamera?: boolean } = {}): Promise<LeasedTask[]> {
  const kinds = lane === 'direct' ? [...DIRECT_KINDS] : [...RESEARCH_KINDS];
  const due = await prisma.agentTask.findMany({
    where: {
      finishedAt: null, kind: { in: kinds }, dueAt: { lte: now }, attempts: { lt: MAX_ATTEMPTS },
      OR: [{ leasedUntil: null }, { leasedUntil: { lt: now } }],
    },
    orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
    take: limit,
  });
  const leased: LeasedTask[] = [];
  const until = new Date(now.getTime() + LEASE_MS);
  const claimedCameras = new Set<string>();
  for (const task of due) {
    if (opts.onePerCamera) {
      const cameraId = await cameraIdOf(task);
      if (cameraId) {
        if (claimedCameras.has(cameraId)) continue;
        claimedCameras.add(cameraId);
      }
    }
    const { count } = await prisma.agentTask.updateMany({
      where: { id: task.id, OR: [{ leasedUntil: null }, { leasedUntil: { lt: now } }] },
      data: { leasedUntil: until, startedAt: task.startedAt ?? now, attempts: { increment: 1 } },
    });
    if (count === 1) {
      leased.push({
        id: task.id, kind: task.kind, subjectType: task.subjectType, subjectId: task.subjectId,
        reason: task.reason, budget: task.budget, attempts: task.attempts + 1, priority: task.priority, dueAt: task.dueAt,
        sessionId: task.sessionId,
      });
    }
  }
  return leased;
}

export async function completeTask(id: string, outcome: string, sessionId?: string): Promise<void> {
  await prisma.agentTask.updateMany({
    where: { id, finishedAt: null },
    data: { finishedAt: new Date(), leasedUntil: null, outcome: outcome.slice(0, 500), ...(sessionId ? { sessionId } : {}) },
  });
}

export async function releaseTask(id: string, delayMs: number, note: string, opts: { refundAttempt?: boolean } = {}): Promise<void> {
  await prisma.agentTask.updateMany({
    where: { id, finishedAt: null },
    data: { leasedUntil: null, dueAt: new Date(Date.now() + delayMs), outcome: note.slice(0, 500) },
  });
  // Lượt bị chặn vì trần token không phải lần thử thật: trả lại để task không bị retireExhausted đóng oan. `attempts > 0` giữ không âm.
  if (opts.refundAttempt) {
    await prisma.agentTask.updateMany({ where: { id, attempts: { gt: 0 } }, data: { attempts: { decrement: 1 } } });
  }
}

export async function retireExhausted(now = new Date()): Promise<number> {
  const { count } = await prisma.agentTask.updateMany({
    where: { finishedAt: null, attempts: { gte: MAX_ATTEMPTS }, OR: [{ leasedUntil: null }, { leasedUntil: { lt: now } }] },
    data: { finishedAt: now, outcome: RETIRED_OUTCOME },
  });
  return count;
}
