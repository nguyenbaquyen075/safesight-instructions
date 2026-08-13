// SPDX-License-Identifier: MIT

import type { User as DbUser } from '@prisma/client';
import type { User } from '@/types/models';
import type { UserRole } from '@/types/enums';

/** Chuyển 1 row User trong DB sang shape User dùng ở frontend (parse assignedSites JSON + tra tên site). */
export function toUserDTO(u: DbUser, siteNameById: Map<string, string>): User {
  const assignedSites: string[] = JSON.parse(u.assignedSites || '[]');
  return {
    id: u.id,
    orgId: u.orgId,
    email: u.email,
    name: u.name,
    role: u.role as UserRole,
    avatarUrl: u.avatarUrl ?? undefined,
    assignedSites,
    assignedSiteNames: assignedSites.map(id => siteNameById.get(id) ?? id),
    isActive: u.isActive,
    twoFactorEnabled: u.twoFactorEnabled,
    lastLogin: u.lastLogin?.toISOString(),
    createdAt: u.createdAt.toISOString(),
  };
}
