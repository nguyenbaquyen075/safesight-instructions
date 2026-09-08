// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MAX_FEEDBACK_ROWS, accuracyRange, agentAccuracy } from '@/lib/agent-accuracy-shape';
import { allowedSiteIds, requireSession } from '@/lib/auth/site-access';

// Độ chính xác của agent theo camera và theo loại vi phạm, dựng từ phản hồi của người
// (Violation.reviewFeedback). Chỉ lấy vi phạm agent đã phán quyết.
export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;

  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get('siteId');
  const allowed = await allowedSiteIds(gate.session);
  if (siteId && allowed && !allowed.includes(siteId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { gte, lte } = accuracyRange(searchParams.get('from'), searchParams.get('to'));
  const rows = await prisma.violation.findMany({
    where: {
      ...(siteId ? { siteId } : allowed ? { siteId: { in: allowed } } : {}),
      detectedAt: { gte, lte },
      agentReview: { not: null },
    },
    select: { cameraId: true, type: true, agentReview: true, reviewFeedback: true, camera: { select: { name: true } } },
    // Cùng trần với CSV: một URL xin 366 ngày của cả tổ chức không được kéo cả bảng.
    orderBy: { detectedAt: 'desc' },
    take: MAX_FEEDBACK_ROWS,
  });

  return NextResponse.json(agentAccuracy(rows.map(r => ({ ...r, cameraName: r.camera.name }))));
}
