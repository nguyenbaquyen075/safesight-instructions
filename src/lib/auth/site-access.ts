// SPDX-License-Identifier: MIT

import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@/types/enums';

export const ORG_WIDE_ROLES: string[] = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN];

// Cổng đăng nhập chung cho route handler: middleware (src/proxy.ts) bỏ qua /api,
// nên mọi handler đọc dữ liệu phải tự gọi hàm này.
// Trả về NextResponse 401 khi chưa đăng nhập, ngược lại trả session để dùng tiếp.
export async function requireSession(): Promise<{ session: Session } | NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return { session };
}

// Danh sách site mà user được xem. null = xem toàn tổ chức (không lọc).
export async function allowedSiteIds(session: Session): Promise<string[] | null> {
  if (ORG_WIDE_ROLES.includes(session.user.role)) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  return user ? (JSON.parse(user.assignedSites) as string[]) : [];
}

export async function assertSiteAccess(siteId: string): Promise<NextResponse | null> {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;

  const allowed = await allowedSiteIds(gate.session);
  if (allowed && !allowed.includes(siteId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
