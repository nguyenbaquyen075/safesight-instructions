// SPDX-License-Identifier: MIT

import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createUserSchema, toUserDTO } from '@/lib/user-shape';
import { ORG_WIDE_ROLES, requireSession } from '@/lib/auth/site-access';
import { logAudit } from '@/lib/audit-log';

const BCRYPT_ROUNDS = 10;

/** Org của user mới = org của người tạo; đăng nhập dev cứng (src/auth.ts) không
 * có dòng User trong DB nên rơi về tổ chức đầu tiên (app hiện là 1-tenant). */
async function resolveOrgId(creatorId: string): Promise<string | null> {
  const creator = await prisma.user.findUnique({ where: { id: creatorId }, select: { orgId: true } });
  if (creator) return creator.orgId;
  const org = await prisma.organization.findFirst({ select: { id: true } });
  return org?.id ?? null;
}

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

export async function POST(request: NextRequest) {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;
  if (!ORG_WIDE_ROLES.includes(gate.session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = createUserSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const orgId = await resolveOrgId(gate.session.user.id);
  if (!orgId) return NextResponse.json({ error: 'Chưa có tổ chức nào trong hệ thống' }, { status: 400 });

  const { name, email, password, role, assignedSites } = parsed.data;
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let user;
  try {
    user = await prisma.user.create({
      data: { orgId, name, email, passwordHash, role, assignedSites: JSON.stringify(assignedSites) },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'Email đã được sử dụng' }, { status: 409 });
    }
    throw err;
  }

  await logAudit({ session: gate.session, action: 'user.create', resource: 'user', resourceId: user.id, details: email, request });

  const sites = await prisma.site.findMany({ select: { id: true, name: true } });
  return NextResponse.json(toUserDTO(user, new Map(sites.map(s => [s.id, s.name]))), { status: 201 });
}
