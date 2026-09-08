// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { assertSiteAccess } from '@/lib/auth/site-access';
import { toViolationDTO } from '@/lib/violation-shape';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const violation = await prisma.violation.findUnique({
    where: { id },
    include: { camera: true, site: true },
  });

  if (!violation) {
    return NextResponse.json({ error: 'Violation not found' }, { status: 404 });
  }

  return NextResponse.json(toViolationDTO(violation));
}

const updateSchema = z.object({
  status: z.enum(['open', 'under_review', 'resolved', 'false_positive']),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await prisma.violation.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const authError = await assertSiteAccess(existing.siteId);
  if (authError) return authError;

  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // DB lưu chữ HOA (khớp default trong schema.prisma), API nhận và trả chữ thường — giống cameras/[id]/route.ts.
  const updated = await prisma.violation.update({
    where: { id },
    data: { status: parsed.data.status.toUpperCase() },
  });
  return NextResponse.json({ id: updated.id, status: updated.status.toLowerCase() });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await prisma.violation.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const authError = await assertSiteAccess(existing.siteId);
  if (authError) return authError;

  await prisma.violation.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
