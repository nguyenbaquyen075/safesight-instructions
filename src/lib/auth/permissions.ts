// SPDX-License-Identifier: MIT

import { UserRole } from '@/types/enums';

const ALL_ROLES = Object.values(UserRole);

/**
 * Vai trò nào được xem trang nào — nguồn duy nhất, Sidebar (ẩn/hiện menu) và
 * DashboardLayout (chặn truy cập thẳng bằng URL) đều đọc từ đây.
 * Trang không có trong danh sách -> coi như ai cũng xem được (VD: Bảng điều khiển "/").
 */
export const PAGE_ROLES: Record<string, UserRole[]> = {
  '/sites': [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.SITE_MANAGER],
  '/analytics': [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.SITE_MANAGER, UserRole.SAFETY_OFFICER],
  '/reports': [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.SITE_MANAGER],
  // Mỗi lần chạy tốn 1 credit Roboflow -> chỉ admin, không mở cho toàn bộ nhân sự.
  '/roboflow': [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN],
  '/users': [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN],
  '/settings': [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN],
  '/agent': [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.SITE_MANAGER],
};

export function rolesForPath(pathname: string): UserRole[] {
  const entry = Object.entries(PAGE_ROLES).find(([path]) => pathname === path || pathname.startsWith(`${path}/`));
  return entry ? entry[1] : ALL_ROLES;
}

export function canAccessPath(role: UserRole | undefined, pathname: string): boolean {
  if (!role) return true; // session chưa tải xong -> không chặn nhầm, chờ vòng render sau
  return rolesForPath(pathname).includes(role);
}

/**
 * Vai trò mà người gọi được phép cấp cho người khác: chỉ SUPER_ADMIN mới cấp được
 * SUPER_ADMIN (docs/ba/05-permission-matrix.md). Dùng chung cho `/api/users`
 * (POST/PATCH) và cho danh sách vai trò trong dialog người dùng.
 */
export function assignableRoles(callerRole: UserRole | undefined): UserRole[] {
  return callerRole === UserRole.SUPER_ADMIN ? ALL_ROLES : ALL_ROLES.filter(r => r !== UserRole.SUPER_ADMIN);
}
