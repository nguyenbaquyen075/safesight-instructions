// SPDX-License-Identifier: MIT
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertSiteAccess } from '@/lib/auth/site-access';
import { enqueueAgentTask, pokeAgent } from '@/lib/agent-bridge';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const camera = await prisma.camera.findUnique({ where: { id }, select: { siteId: true } });
  if (!camera) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const authError = await assertSiteAccess(camera.siteId);
  if (authError) return authError;

  // Ưu tiên thấp hơn violation.review (300): tổng hợp không được chen trước vi phạm mới.
  // Task gộp vào lần hẹn digest đang chờ nếu có (enqueueAgentTask), nên bấm nhiều lần không xếp chồng.
  const taskId = await enqueueAgentTask({ kind: 'camera.digest', subjectType: 'camera', subjectId: id, reason: 'Người dùng yêu cầu tổng hợp', priority: 60 });
  pokeAgent('/internal/dispatch');
  return NextResponse.json({ taskId }, { status: 202 });
}
