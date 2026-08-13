'use client';
// SPDX-License-Identifier: MIT

import * as React from 'react';
import type { SiteStatusSummary, Violation } from '@/types/models';
import { mockCameras } from '@/data/mock-cameras';
import { CameraStatus, SiteStatus } from '@/types/enums';
import { rateFromCount } from './use-dashboard';

/** Gom công trình THẬT theo roster camera (mockCameras) + số vi phạm thật cho site đó. */
export function useRealSitesFromCameras(violations: Violation[]): SiteStatusSummary[] {
  return React.useMemo(() => {
    const bySite = new Map<string, { name: string; cameraCount: number; onlineCameras: number }>();
    mockCameras.forEach(cam => {
      const entry = bySite.get(cam.siteId) ?? { name: cam.siteName, cameraCount: 0, onlineCameras: 0 };
      entry.cameraCount++;
      if (cam.status === CameraStatus.ONLINE) entry.onlineCameras++;
      bySite.set(cam.siteId, entry);
    });
    return Array.from(bySite.entries()).map(([id, s]) => {
      const siteViolations = violations.filter(v => v.siteName === s.name).length;
      return {
        id,
        name: s.name,
        complianceRate: rateFromCount(siteViolations),
        activeAlerts: siteViolations,
        cameraCount: s.cameraCount,
        onlineCameras: s.onlineCameras,
        status: s.onlineCameras === 0 ? SiteStatus.SETUP : SiteStatus.ACTIVE,
      };
    });
  }, [violations]);
}
