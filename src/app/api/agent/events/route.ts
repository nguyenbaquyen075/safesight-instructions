// SPDX-License-Identifier: MIT
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { AgentEventView } from '@/types/agent';

function parseData(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { return { corrupt: true, raw: raw.slice(0, 200) }; }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = request.nextUrl.searchParams;
  const since = q.get('since');
  const sinceDate = since ? new Date(since) : undefined;
  if (sinceDate && Number.isNaN(sinceDate.getTime())) return NextResponse.json({ error: 'since không phải ngày hợp lệ' }, { status: 400 });
  const limit = Math.min(Math.max(Number.parseInt(q.get('limit') ?? '', 10) || 100, 1), 500);
  const rows = await prisma.agentEvent.findMany({
    where: {
      sessionId: q.get('sessionId') ?? undefined,
      subjectType: q.get('subjectType') ?? undefined,
      subjectId: q.get('subjectId') ?? undefined,
      type: q.get('type') ?? undefined,
      emittedAt: sinceDate ? { gte: sinceDate } : undefined,
    },
    orderBy: { emittedAt: q.get('sessionId') ? 'asc' : 'desc' },
    take: limit,
  });
  const view: AgentEventView[] = rows.map(e => ({
    id: e.id, sessionId: e.sessionId, taskId: e.taskId, subjectType: e.subjectType, subjectId: e.subjectId, type: e.type,
    data: parseData(e.data), emittedAt: e.emittedAt.toISOString(),
  }));
  return NextResponse.json(view);
}
