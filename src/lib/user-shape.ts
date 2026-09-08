// SPDX-License-Identifier: MIT

import { z } from 'zod';
import type { User as DbUser } from '@prisma/client';
import type { User } from '@/types/models';
import { UserRole } from '@/types/enums';

/** Zod cho `POST /api/users` — dùng chung giữa API và test thuần (không đụng DB). */
export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole),
  assignedSites: z.array(z.string()).default([]),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

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
