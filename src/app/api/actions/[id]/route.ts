// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertSiteAccess, requireSession } from '@/lib/auth/site-access';
import { logAudit } from '@/lib/audit-log';
import { toActionDTO, updateActionSchema } from '@/lib/corrective-action-shape';

// Đổi trạng thái một việc khắc phục. DONE ghi completedAt; khi vi phạm không còn việc nào
// đang mở và đã có ít nhất một việc DONE thì đóng luôn vi phạm (RESOLVED) — người xử lý
// không phải bấm thêm một nút nữa ở modal.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const existing = await prisma.correctiveAction.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Corrective action not found' }, { status: 404 });

  const authError = await assertSiteAccess(existing.siteId);
  if (authError) return authError;

  const parsed = updateActionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.correctiveAction.update({
    where: { id },
    data: {
      status: parsed.data.status,
      evidenceNote: parsed.data.evidenceNote,
      completedAt: parsed.data.status === 'DONE' ? new Date() : null,
      // Mở lại một việc thì xoá luôn dấu "đã leo thang": nếu không, lần quá hạn sau
      // agent sẽ bỏ qua nó vĩnh viễn (findOverdueActions lọc escalatedAt = null).
      ...(parsed.data.status === 'OPEN' ? { escalatedAt: null } : {}),
    },
  });

  const [stillOpen, done] = await Promise.all([
    prisma.correctiveAction.count({ where: { violationId: existing.violationId, status: 'OPEN' } }),
    prisma.correctiveAction.count({ where: { violationId: existing.violationId, status: 'DONE' } }),
  ]);
  if (stillOpen === 0 && done > 0) {
    await prisma.violation.update({ where: { id: existing.violationId }, data: { status: 'RESOLVED' } });
  }

  await logAudit({ session: gate.session, action: 'violation.action.update', resource: 'violation', resourceId: existing.violationId, details: `${id} → ${parsed.data.status}`, request });

  return NextResponse.json(toActionDTO(updated));
}
