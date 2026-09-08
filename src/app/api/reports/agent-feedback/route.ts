// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AGENT_FEEDBACK_CSV_HEADER, accuracyRange, csvRow } from '@/lib/agent-accuracy-shape';
import { allowedSiteIds, requireSession } from '@/lib/auth/site-access';
import { parseJsonOr } from '@/lib/violation-shape';
import type { AgentReview, ReviewFeedback } from '@/types/agent';

// Trần số dòng: file để nạp vào training/, không phải kho lưu trữ — 20k dòng đã là vài tháng
// phản hồi và vẫn dựng được trong bộ nhớ. Cần nhiều hơn thì thu hẹp khoảng ngày.
const MAX_ROWS = 20_000;

// Bộ dữ liệu retrain: mỗi dòng là một vi phạm agent đã phán quyết VÀ người đã chấm đúng/sai.
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
      reviewFeedback: { not: null },
    },
    orderBy: { detectedAt: 'desc' },
    take: MAX_ROWS,
    select: { id: true, cameraId: true, type: true, detectedAt: true, snapshotUrl: true, clipUrl: true, agentReview: true, reviewFeedback: true },
  });

  const lines = [csvRow([...AGENT_FEEDBACK_CSV_HEADER])];
  for (const r of rows) {
    const review = parseJsonOr<AgentReview | null>(r.agentReview, null);
    const feedback = parseJsonOr<ReviewFeedback | null>(r.reviewFeedback, null);
    if (!feedback || typeof feedback.correct !== 'boolean') continue;
    lines.push(csvRow([r.id, r.cameraId, r.type, r.detectedAt.toISOString(), r.snapshotUrl, r.clipUrl, review?.verdict, review?.band, String(feedback.correct), feedback.note]));
  }

  const day = (d: Date) => d.toISOString().slice(0, 10);
  // BOM để Excel bản tiếng Việt không đọc hỏng dấu (giống CSV dựng ở /reports).
  return new NextResponse(`﻿${lines.join('\n')}\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="phan-hoi-agent-${day(gte)}-den-${day(lte)}.csv"`,
    },
  });
}
