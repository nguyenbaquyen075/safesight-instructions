// SPDX-License-Identifier: MIT

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { allowedSiteIds, requireSession } from '@/lib/auth/site-access';

// Sidebar chỉ cần con số badge, không cần cả bảng vi phạm — COUNT thay vì findMany
// (Sidebar nằm trên mọi trang dashboard và poll 15s một lần).
export async function GET() {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;

  const allowed = await allowedSiteIds(gate.session);
  const open = await prisma.violation.count({
    where: { status: 'OPEN', ...(allowed ? { siteId: { in: allowed } } : {}) },
  });
  return NextResponse.json({ open });
}
