// SPDX-License-Identifier: MIT

import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@/types/enums';

export const ORG_WIDE_ROLES: string[] = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN];

// Tạo / sửa / xoá / bật tắt quy tắc cảnh báo (docs/ba/05-permission-matrix.md):
// quản trị hệ thống, quản trị tổ chức và quản lý công trường (O* — vẫn phải qua
// assertSiteAccess theo site được gán). Cán bộ an toàn và giám sát viên chỉ xem.
export const ALERT_RULE_WRITE_ROLES: string[] = [...ORG_WIDE_ROLES, UserRole.SITE_MANAGER];

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
  // Phòng session cũ còn role chữ HOA: so sánh không phân biệt hoa/thường.
  if (ORG_WIDE_ROLES.includes(String(session.user.role).toLowerCase())) return null;
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
