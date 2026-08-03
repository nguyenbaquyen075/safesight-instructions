// SPDX-License-Identifier: MIT

/* ===== SafeSight AI — Mock Data: Users ===== */

import { UserRole } from '@/types/enums';
import type { User } from '@/types/models';

export const mockUsers: User[] = [
  {
    id: 'user-001', orgId: 'org-001', email: 'an.nguyen@safesight.ai', name: 'Nguyễn Văn An',
    role: UserRole.SAFETY_OFFICER, assignedSites: ['site-001', 'site-003'],
    assignedSiteNames: ['Vinhomes Grand Park', 'Lumière Riverside'],
    isActive: true, twoFactorEnabled: true, lastLogin: '2026-04-22T08:00:00Z', createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'user-002', orgId: 'org-001', email: 'bich.tran@safesight.ai', name: 'Trần Thị Bích',
    role: UserRole.ORG_ADMIN, assignedSites: ['site-001', 'site-002', 'site-003', 'site-004', 'site-005'],
    assignedSiteNames: ['Vinhomes Grand Park', 'Masteri Centre Point', 'Lumière Riverside', 'The Global City', 'Eaton Park'],
    isActive: true, twoFactorEnabled: true, lastLogin: '2026-04-22T09:00:00Z', createdAt: '2026-01-05T08:00:00Z',
  },
  {
    id: 'user-003', orgId: 'org-001', email: 'duc.pham@safesight.ai', name: 'Phạm Minh Đức',
    role: UserRole.SUPERVISOR, assignedSites: ['site-001'],
    assignedSiteNames: ['Vinhomes Grand Park'],
    isActive: true, twoFactorEnabled: false, lastLogin: '2026-04-22T06:30:00Z', createdAt: '2026-02-01T08:00:00Z',
  },
  {
    id: 'user-004', orgId: 'org-001', email: 'huong.le@safesight.ai', name: 'Lê Thị Hương',
    role: UserRole.SITE_MANAGER, assignedSites: ['site-002', 'site-004'],
    assignedSiteNames: ['Masteri Centre Point', 'The Global City'],
    isActive: true, twoFactorEnabled: true, lastLogin: '2026-04-21T17:00:00Z', createdAt: '2026-01-20T08:00:00Z',
  },
  {
    id: 'user-005', orgId: 'org-001', email: 'admin@safesight.ai', name: 'SafeSight Admin',
    role: UserRole.SUPER_ADMIN, assignedSites: [],
    assignedSiteNames: [],
    isActive: true, twoFactorEnabled: true, lastLogin: '2026-04-22T10:00:00Z', createdAt: '2026-01-01T08:00:00Z',
  },
];

export function getMockUser(id: string): User | undefined {
  return mockUsers.find((u) => u.id === id);
}
