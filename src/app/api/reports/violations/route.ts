// SPDX-License-Identifier: MIT
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toViolationDTO } from '@/lib/violation-shape';
import { buildReportSummary, type ViolationReport } from '@/lib/report-shape';
import { allowedSiteIds, requireSession } from '@/lib/auth/site-access';

const DEFAULT_DAYS = 7;
// Trần cho bảng chi tiết và cho CSV: đủ cho một quý ở quy mô hiện tại, vẫn giữ
// response ở mức vài MB thay vì tải cả bảng vi phạm về trình duyệt.
const MAX_ROWS = 2000;

// Khoảng ngày do người dùng nhập ("2026-09-01") -> nguyên ngày theo giờ máy chủ.
function parseRange(from: string | null, to: string | null): { start: Date; end: Date } {
  const end = to ? new Date(`${to}T23:59:59.999`) : new Date();
  const start = from ? new Date(`${from}T00:00:00.000`) : new Date(end.getTime() - DEFAULT_DAYS * 86_400_000);
  return {
    start: Number.isNaN(start.getTime()) ? new Date(Date.now() - DEFAULT_DAYS * 86_400_000) : start,
    end: Number.isNaN(end.getTime()) ? new Date() : end,
  };
}

export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;

  const q = request.nextUrl.searchParams;
  const siteId = q.get('siteId');
  const cameraId = q.get('cameraId');
  const allowed = await allowedSiteIds(gate.session);
  if (siteId && allowed && !allowed.includes(siteId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { start, end } = parseRange(q.get('from'), q.get('to'));

  const rows = await prisma.violation.findMany({
    where: {
      ...(siteId ? { siteId } : allowed ? { siteId: { in: allowed } } : {}),
      ...(cameraId ? { cameraId } : {}),
      detectedAt: { gte: start, lte: end },
    },
    include: { camera: { select: { name: true } }, site: { select: { name: true } } },
    orderBy: { detectedAt: 'desc' },
    take: MAX_ROWS,
  });

  const dto = rows.map(toViolationDTO);
  const report: ViolationReport = {
    range: { from: start.toISOString(), to: end.toISOString() },
    byCamera: buildReportSummary(dto),
    rows: dto,
  };
  return NextResponse.json(report);
}
