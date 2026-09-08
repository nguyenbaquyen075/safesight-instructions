// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toUserDTO } from '@/lib/user-shape';
import { ORG_WIDE_ROLES, requireSession } from '@/lib/auth/site-access';

export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;
  // Trang /users chỉ mở cho SUPER_ADMIN/ORG_ADMIN (src/lib/auth/permissions.ts) — API khớp theo.
  if (!ORG_WIDE_ROLES.includes(gate.session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
