// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { toUserDTO } from '@/lib/user-shape';
import { ORG_WIDE_ROLES } from '@/lib/auth/site-access';
import { assignableRoles } from '@/lib/auth/permissions';
import { logAudit } from '@/lib/audit-log';
import { UserRole } from '@/types/enums';

async function loadSiteNameMap() {
  const sites = await prisma.site.findMany({ select: { id: true, name: true } });
  return new Map(sites.map(s => [s.id, s.name]));
}

/** Cả 3 handler đều là thao tác quản trị người dùng: đăng nhập + SUPER_ADMIN/ORG_ADMIN. */
async function gateOrgWide() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ORG_WIDE_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return session;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await gateOrgWide();
  if (gate instanceof NextResponse) return gate;

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
  const gate = await gateOrgWide();
  if (gate instanceof NextResponse) return gate;
  const session = gate;

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  // Nâng quyền: ORG_ADMIN không được cấp SUPER_ADMIN, và không ai được tự đổi vai trò
  // của chính mình (tự nâng lên hoặc tự khoá mình ra khỏi trang quản trị).
  if (parsed.data.role !== undefined) {
    if (id === session.user.id) {
      return NextResponse.json({ error: 'Không thể tự đổi vai trò của chính mình' }, { status: 403 });
    }
    if (!assignableRoles(session.user.role).includes(parsed.data.role)) {
      return NextResponse.json({ error: 'Chỉ SUPER_ADMIN mới cấp được vai trò SUPER_ADMIN' }, { status: 403 });
    }
  }
  const { assignedSites, ...rest } = parsed.data;

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...rest,
      ...(assignedSites ? { assignedSites: JSON.stringify(assignedSites) } : {}),
    },
  });

  await logAudit({ session, action: 'user.update', resource: 'user', resourceId: id, details: JSON.stringify(parsed.data), request });

  return NextResponse.json(toUserDTO(user, await loadSiteNameMap()));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await gateOrgWide();
  if (gate instanceof NextResponse) return gate;
  const session = gate;

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: 'Không thể tự xoá tài khoản của chính mình' }, { status: 403 });
  }
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.user.delete({ where: { id } });
  await logAudit({ session, action: 'user.delete', resource: 'user', resourceId: id, details: existing.email, request });
  return NextResponse.json({ success: true });
}
