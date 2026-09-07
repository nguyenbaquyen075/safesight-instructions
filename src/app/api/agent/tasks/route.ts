// SPDX-License-Identifier: MIT
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { AgentTaskView } from '@/types/agent';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = request.nextUrl.searchParams;
  const status = q.get('status') ?? 'open';
  const limit = Math.min(Math.max(Number.parseInt(q.get('limit') ?? '', 10) || 50, 1), 200);
  const rows = await prisma.agentTask.findMany({
    where: {
      finishedAt: status === 'done' ? { not: null } : null,
      subjectType: q.get('subjectType') ?? undefined,
      subjectId: q.get('subjectId') ?? undefined,
    },
    orderBy: status === 'done' ? { finishedAt: 'desc' } : [{ priority: 'desc' }, { dueAt: 'asc' }],
    take: limit,
  });
  const view: AgentTaskView[] = rows.map(t => ({
    id: t.id, kind: t.kind, subjectType: t.subjectType, subjectId: t.subjectId, reason: t.reason, priority: t.priority, attempts: t.attempts,
    dueAt: t.dueAt.toISOString(), startedAt: t.startedAt?.toISOString() ?? null, finishedAt: t.finishedAt?.toISOString() ?? null, outcome: t.outcome, sessionId: t.sessionId,
  }));
  return NextResponse.json(view);
}
