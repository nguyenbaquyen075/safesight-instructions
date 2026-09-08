// SPDX-License-Identifier: MIT
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { pokeAgent } from '@/lib/agent-bridge';

// Giữ khớp với MAX_ATTEMPTS trong agent/lib/tasks.ts (không import: file đó kéo theo Prisma client riêng của worker).
const MAX_ATTEMPTS = 3;

const askSchema = z.object({
  message: z.string().min(1).max(2000),
  subjectType: z.enum(['violation', 'camera', 'site', 'system']).default('system'),
  subjectId: z.string().optional(),
  sessionId: z.string().uuid().optional(),
});

// Không gọi model ở đây: ghi message.user + task ask, agent tự trả lời; panel poll /api/agent/events?sessionId.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = askSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { message, subjectType, subjectId, sessionId: given } = parsed.data;
  const sessionId = given ?? randomUUID();
  // sessionId đoán được: chỉ người mở thread mới được hỏi tiếp trong đó (event message.user đầu tiên giữ chủ sở hữu).
  if (given) {
    const first = await prisma.agentEvent.findFirst({ where: { sessionId: given, type: 'message.user' }, orderBy: { emittedAt: 'asc' }, select: { data: true } });
    let ownerId: string | null = null;
    try { ownerId = first ? (JSON.parse(first.data).userId ?? null) : null; } catch { ownerId = null; }
    if (ownerId && ownerId !== session.user.id) return NextResponse.json({ error: 'Thread này thuộc người dùng khác' }, { status: 403 });
  }
  await prisma.agentEvent.create({ data: { sessionId, subjectType, subjectId: subjectId ?? null, type: 'message.user', data: JSON.stringify({ text: message, userId: session.user.id, userName: session.user.name ?? '' }) } });
  // Câu hỏi thứ hai khi agent đang trả lời câu trước: tạo task mới, không gộp vào task đang lease (completeTask sẽ đóng luôn lượt sau).
  // Cùng vị từ với claimDue (agent/lib/tasks.ts): task đã hết lượt thì KHÔNG nối lại — reset attempts
  // về 0 sẽ đua với retireExhausted và có thể bị đóng ngay sau đó, câu hỏi rơi âm thầm. Cứ tạo task mới.
  const open = await prisma.agentTask.findFirst({ where: { kind: 'ask', sessionId, finishedAt: null, attempts: { lt: MAX_ATTEMPTS }, OR: [{ leasedUntil: null }, { leasedUntil: { lt: new Date() } }] }, select: { id: true } });
  // updateMany + finishedAt: null — task có thể vừa xong/bị retire giữa lúc đọc và lúc ghi; 0 dòng thì tạo mới.
  const reused = open && (await prisma.agentTask.updateMany({ where: { id: open.id, finishedAt: null }, data: { reason: message.slice(0, 200), dueAt: new Date() } })).count === 1
    ? open : null;
  const task = reused ?? await prisma.agentTask.create({ data: { kind: 'ask', subjectType, subjectId: subjectId ?? null, reason: message.slice(0, 200), priority: 500, budget: 8, dueAt: new Date(), sessionId }, select: { id: true } });
  pokeAgent('/internal/ask', { taskId: task.id });
  return NextResponse.json({ sessionId, taskId: task.id }, { status: 202 });
}
