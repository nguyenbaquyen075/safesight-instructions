// SPDX-License-Identifier: MIT

import type { Site as DbSite } from '@prisma/client';
import type { Site } from '@/types/models';
import type { SiteStatus } from '@/types/enums';

/** Chuyển 1 row Site thật trong DB sang shape Site dùng ở frontend. */
export function toSiteDTO(s: DbSite): Site {
  return {
    id: s.id,
    orgId: s.orgId,
    name: s.name,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    status: s.status as SiteStatus,
    cameraCount: s.cameraCount,
    onlineCameraCount: s.onlineCameraCount,
    workerCount: s.workerCount,
    complianceRate: s.complianceRate,
    activeAlerts: s.activeAlerts,
    todayViolations: s.todayViolations,
    imageUrl: s.imageUrl ?? undefined,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}
