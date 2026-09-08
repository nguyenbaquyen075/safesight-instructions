// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertSiteAccess, requireSession } from '@/lib/auth/site-access';
import { logAudit } from '@/lib/audit-log';
import { buildReviewFeedback, reviewFeedbackSchema } from '@/lib/agent-accuracy-shape';
import { toViolationDTO } from '@/lib/violation-shape';

// Người chấm phán quyết của agent: đúng hay sai. Ghi đè được (bấm nhầm thì bấm lại) —
// mỗi vi phạm chỉ giữ phản hồi mới nhất, lịch sử nằm ở AuditLog.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const existing = await prisma.violation.findUnique({ where: { id }, select: { id: true, siteId: true, agentReview: true } });
  if (!existing) return NextResponse.json({ error: 'Violation not found' }, { status: 404 });

  const authError = await assertSiteAccess(existing.siteId);
  if (authError) return authError;

  // Chưa có phán quyết thì không có gì để chấm: 409 để giao diện hiện "agent chưa review".
  if (!existing.agentReview) {
    return NextResponse.json({ error: 'Violation has no agent review yet' }, { status: 409 });
  }

  const parsed = reviewFeedbackSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const feedback = buildReviewFeedback(parsed.data, gate.session.user);
  const updated = await prisma.violation.update({
    where: { id },
    data: { reviewFeedback: JSON.stringify(feedback) },
    include: { camera: { select: { name: true } }, site: { select: { name: true } } },
  });

  await logAudit({
    session: gate.session,
    action: 'violation.review.feedback',
    resource: 'violation',
    resourceId: id,
    details: `${feedback.correct ? 'đúng' : 'sai'}${feedback.note ? `: ${feedback.note}` : ''}`,
    request,
  });

  return NextResponse.json(toViolationDTO(updated));
}
