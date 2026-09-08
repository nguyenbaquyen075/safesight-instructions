// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { complianceByDay } from '@/lib/compliance-shape';
import { allowedSiteIds, requireSession } from '@/lib/auth/site-access';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 30;
const MAX_DAYS = 366; // trần để một URL cố ý xin 10 năm không quét cả bảng

const parseDate = (raw: string | null, fallback: number) => {
  const ts = raw ? Date.parse(raw) : NaN;
  return new Date(Number.isNaN(ts) ? fallback : ts);
};

// Tỉ lệ tuân thủ theo ngày, tính từ số người quan sát được (ObservationStat) và số
// vi phạm thật — thay cách ước lượng cũ trong use-dashboard.ts.
export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;

  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get('siteId');
  const allowed = await allowedSiteIds(gate.session);
  if (siteId && allowed && !allowed.includes(siteId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = Date.now();
  const to = parseDate(searchParams.get('to'), now);
  let from = parseDate(searchParams.get('from'), now - (DEFAULT_DAYS - 1) * DAY_MS);
  if (from > to) from = to;
  if (to.getTime() - from.getTime() > MAX_DAYS * DAY_MS) from = new Date(to.getTime() - MAX_DAYS * DAY_MS);

  // Cả hai truy vấn lấy trọn ngày đầu/cuối theo UTC — cùng quy ước gom ngày của complianceByDay.
  const gte = new Date(`${from.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const lte = new Date(`${to.toISOString().slice(0, 10)}T23:59:59.999Z`);
  const siteFilter = siteId ? { siteId } : allowed ? { siteId: { in: allowed } } : {};

  const [stats, violations] = await Promise.all([
    prisma.observationStat.findMany({
      where: { ...siteFilter, minute: { gte, lte } },
      select: { minute: true, personSeconds: true },
    }),
    prisma.violation.findMany({
      where: { ...siteFilter, detectedAt: { gte, lte } },
      select: { detectedAt: true },
    }),
  ]);

  return NextResponse.json(complianceByDay(stats, violations, from, to));
}
