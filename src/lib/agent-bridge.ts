// SPDX-License-Identifier: MIT
import { prisma } from '@/lib/prisma';

const AGENT_URL = `http://127.0.0.1:${process.env.AGENT_PORT ?? 4002}`;

export async function enqueueAgentTask(input: { kind: string; subjectType: string; subjectId?: string | null; reason: string; priority: number; budget?: number; dueAt?: Date }): Promise<string> {
  // Task đang chạy (còn lease) không bao giờ là đích gộp — nếu gộp vào nó, completeTask sẽ đóng luôn lần hẹn sau.
  const existing = await prisma.agentTask.findFirst({ where: { kind: input.kind, finishedAt: null, subjectType: input.subjectType, subjectId: input.subjectId ?? null, OR: [{ leasedUntil: null }, { leasedUntil: { lt: new Date() } }] }, select: { id: true } });
  if (existing) { await prisma.agentTask.update({ where: { id: existing.id }, data: { reason: input.reason, dueAt: input.dueAt ?? new Date() } }); return existing.id; }
  const row = await prisma.agentTask.create({ data: { kind: input.kind, subjectType: input.subjectType, subjectId: input.subjectId ?? null, reason: input.reason, priority: input.priority, budget: input.budget ?? 6, dueAt: input.dueAt ?? new Date() }, select: { id: true } });
  return row.id;
}

// Fire-and-forget: row đã là thông điệp; thiếu secret thì KHÔNG gọi (agent tự nhặt ở vòng 20s).
export function pokeAgent(path: '/internal/dispatch' | '/internal/ask', body: unknown = {}): void {
  const secret = process.env.AGENT_BRIDGE_SECRET?.trim();
  if (!secret) return;
  fetch(`${AGENT_URL}${path}`, { method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(2000) })
    .catch(err => console.warn('[agent-bridge] poke thất bại', err instanceof Error ? err.message : String(err)));
}
