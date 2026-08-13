// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toUserDTO } from '@/lib/user-shape';

export async function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get('role');

  const [rows, sites] = await Promise.all([
    prisma.user.findMany({
      where: role ? { role } : undefined,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.site.findMany({ select: { id: true, name: true } }),
  ]);
  const siteNameById = new Map(sites.map(s => [s.id, s.name]));

  return NextResponse.json(rows.map(u => toUserDTO(u, siteNameById)));
}
