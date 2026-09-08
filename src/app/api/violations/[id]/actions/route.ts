// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertSiteAccess, requireSession } from '@/lib/auth/site-access';
import { logAudit } from '@/lib/audit-log';
import { createActionSchema, toActionDTO } from '@/lib/corrective-action-shape';

/** Vi phạm + kiểm quyền theo công trường. Trả NextResponse khi hỏng để handler return thẳng. */
async function loadViolation(id: string) {
  const violation = await prisma.violation.findUnique({ where: { id }, select: { id: true, siteId: true, status: true } });
  if (!violation) return NextResponse.json({ error: 'Violation not found' }, { status: 404 });
  const authError = await assertSiteAccess(violation.siteId);
  if (authError) return authError;
  return violation;
}

async function listActions(violationId: string) {
  const rows = await prisma.correctiveAction.findMany({ where: { violationId }, orderBy: { dueAt: 'asc' } });
  return rows.map(r => toActionDTO(r));
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const violation = await loadViolation(id);
  if (violation instanceof NextResponse) return violation;

  return NextResponse.json({ actions: await listActions(id) });
}

// Giao việc khắc phục cho một người. Vi phạm còn OPEN thì chuyển sang UNDER_REVIEW: đã có
// người nhận việc nghĩa là hồ sơ đang được xử lý, không còn là "chưa ai đụng tới".
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const violation = await loadViolation(id);
  if (violation instanceof NextResponse) return violation;

  const parsed = createActionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const created = await prisma.correctiveAction.create({
    data: {
      violationId: id,
      siteId: violation.siteId,
      assigneeId: parsed.data.assigneeId,
      assigneeName: parsed.data.assigneeName,
      description: parsed.data.description,
      dueAt: parsed.data.dueAt,
      createdById: gate.session.user.id,
    },
  });
  if (violation.status === 'OPEN') {
    await prisma.violation.update({ where: { id }, data: { status: 'UNDER_REVIEW' } });
  }

  await logAudit({ session: gate.session, action: 'violation.action.create', resource: 'violation', resourceId: id, details: `${parsed.data.assigneeName}: ${parsed.data.description}`, request });

  return NextResponse.json(toActionDTO(created), { status: 201 });
}
