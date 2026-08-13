// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { toUserDTO } from '@/lib/user-shape';
import { ORG_WIDE_ROLES } from '@/lib/auth/site-access';
import { UserRole } from '@/types/enums';

async function loadSiteNameMap() {
  const sites = await prisma.site.findMany({ select: { id: true, name: true } });
  return new Map(sites.map(s => [s.id, s.name]));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json(toUserDTO(user, await loadSiteNameMap()));
}

const updateSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),
  assignedSites: z.array(z.string()).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ORG_WIDE_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { assignedSites, ...rest } = parsed.data;

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...rest,
      ...(assignedSites ? { assignedSites: JSON.stringify(assignedSites) } : {}),
    },
  });

  return NextResponse.json(toUserDTO(user, await loadSiteNameMap()));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ORG_WIDE_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
