// SPDX-License-Identifier: MIT

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@/types/enums';

export const ORG_WIDE_ROLES: string[] = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN];

export async function assertSiteAccess(siteId: string): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ORG_WIDE_ROLES.includes(session.user.role)) return null;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const assignedSites: string[] = user ? JSON.parse(user.assignedSites) : [];
  if (!assignedSites.includes(siteId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
