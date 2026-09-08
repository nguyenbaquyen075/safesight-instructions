// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toSiteDTO } from '@/lib/site-shape';
import { allowedSiteIds, requireSession } from '@/lib/auth/site-access';

export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;

  const status = request.nextUrl.searchParams.get('status');
  // null = vai trò toàn tổ chức; ngược lại chỉ trả các site được giao.
  const allowed = await allowedSiteIds(gate.session);

  const rows = await prisma.site.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(allowed ? { id: { in: allowed } } : {}),
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(rows.map(toSiteDTO));
}
