// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { assertSiteAccess, requireSession } from '@/lib/auth/site-access';
import { logAudit } from '@/lib/audit-log';
import { announce } from '@/lib/announce';
import { ANNOUNCE_MAX, announcementFor } from '@/lib/announce-shape';

const announceSchema = z.object({
  text: z.string().trim().min(1).max(ANNOUNCE_MAX).optional(),
  violationId: z.string().optional(),
});

// Phát một câu qua loa của camera. Không có text thì dựng câu mặc định từ vi phạm.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const camera = await prisma.camera.findUnique({ where: { id } });
  if (!camera) return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
  const authError = await assertSiteAccess(camera.siteId);
  if (authError) return authError;

  const parsed = announceSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  let text = parsed.data.text;
  if (!text) {
    if (!parsed.data.violationId) {
      return NextResponse.json({ error: 'Cần text hoặc violationId' }, { status: 400 });
    }
    const violation = await prisma.violation.findUnique({ where: { id: parsed.data.violationId } });
    // Vi phạm của camera khác không được mượn loa camera này.
    if (!violation || violation.cameraId !== id) {
      return NextResponse.json({ error: 'Vi phạm không thuộc camera này' }, { status: 404 });
    }
    text = announcementFor(violation, camera);
  }

  const result = await announce(id, text);
  await logAudit({ session: gate.session, action: 'camera.announce', resource: 'camera', resourceId: id, details: text, request });

  return NextResponse.json({ ...result, text });
}
