// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toSiteDTO } from '@/lib/site-shape';

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get('status');

  const rows = await prisma.site.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(rows.map(toSiteDTO));
}
