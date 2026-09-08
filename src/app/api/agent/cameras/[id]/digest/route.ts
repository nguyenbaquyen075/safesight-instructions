// SPDX-License-Identifier: MIT
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertSiteAccess, requireSession } from '@/lib/auth/site-access';
import { UserRole } from '@/types/enums';

// Spec §6: chỉ quản trị và quản lý công trường (trong site) mới được yêu cầu tổng hợp — tốn token.
const DIGEST_ROLES: string[] = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.SITE_MANAGER];
import { enqueueAgentTask, pokeAgent } from '@/lib/agent-bridge';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const camera = await prisma.camera.findUnique({ where: { id }, select: { siteId: true } });
  if (!camera) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;
  if (!DIGEST_ROLES.includes(String(gate.session.user.role).toLowerCase())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const authError = await assertSiteAccess(camera.siteId);
  if (authError) return authError;

  // Ưu tiên thấp hơn violation.review (300): tổng hợp không được chen trước vi phạm mới.
  // Task gộp vào lần hẹn digest đang chờ nếu có (enqueueAgentTask), nên bấm nhiều lần không xếp chồng.
  const taskId = await enqueueAgentTask({ kind: 'camera.digest', subjectType: 'camera', subjectId: id, reason: 'Người dùng yêu cầu tổng hợp', priority: 60 });
  pokeAgent('/internal/dispatch');
  return NextResponse.json({ taskId }, { status: 202 });
}
