// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { allowedSiteIds, requireSession } from '@/lib/auth/site-access';
import { toActionDTO } from '@/lib/corrective-action-shape';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

// Việc khắc phục còn mở của các công trường người dùng được xem — nguồn cho mục
// "Việc khắc phục" ở /reports. status=overdue lọc thêm những việc đã quá hạn.
export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;

  const siteId = request.nextUrl.searchParams.get('siteId');
  const status = request.nextUrl.searchParams.get('status') === 'overdue' ? 'overdue' : 'open';
  // Kẹp cả hai đầu: limit=0/-5/abc không được biến thành "lấy hết" hay một truy vấn vô nghĩa.
  const requested = Number(request.nextUrl.searchParams.get('limit'));
  const limit = Number.isFinite(requested) && requested > 0 ? Math.min(Math.max(1, Math.floor(requested)), MAX_LIMIT) : DEFAULT_LIMIT;

  const allowed = await allowedSiteIds(gate.session);
  if (siteId && allowed && !allowed.includes(siteId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await prisma.correctiveAction.findMany({
    where: {
      status: 'OPEN',
      ...(siteId ? { siteId } : allowed ? { siteId: { in: allowed } } : {}),
      ...(status === 'overdue' ? { dueAt: { lt: new Date() } } : {}),
    },
    orderBy: { dueAt: 'asc' },
    take: limit,
  });

  return NextResponse.json({ actions: rows.map(r => toActionDTO(r)) });
}
