// SPDX-License-Identifier: MIT

/* ===== SafeSight AI — Mock Data: Violations ===== */

import { ViolationType, Severity, ViolationStatus } from '@/types/enums';
import type { Violation } from '@/types/models';

export const mockViolations: Violation[] = [
  {
    id: 'viol-001', cameraId: 'cam-002', cameraName: 'Tầng 15 - Khu vực cốt thép',
    siteId: 'site-001', siteName: 'Vinhomes Grand Park', zoneId: 'zone-001', zoneName: 'Khu vực cốt thép nguy hiểm',
    type: ViolationType.HARD_HAT, severity: Severity.CRITICAL, confidence: 0.96,
    bboxData: [{ x: 245, y: 180, width: 85, height: 120, label: 'no_hardhat', confidence: 0.96 }],
    snapshotUrl: '/snapshots/violation_20260427-163809.jpg', clipUrl: '/videos/test1.mp4',
    status: ViolationStatus.OPEN, detectedAt: '2026-04-22T16:58:23Z', createdAt: '2026-04-22T16:58:23Z',
  },
  {
    id: 'viol-002', cameraId: 'cam-003', cameraName: 'Khu vực cẩu tháp #1',
    siteId: 'site-001', siteName: 'Vinhomes Grand Park', zoneId: 'zone-002', zoneName: 'Vùng cấm cẩu tháp',
    type: ViolationType.ZONE_INTRUSION, severity: Severity.CRITICAL, confidence: 0.98,
    bboxData: [{ x: 310, y: 220, width: 60, height: 140, label: 'person_in_zone', confidence: 0.98 }],
    snapshotUrl: '/snapshots/violation_20260427-163810.jpg', clipUrl: '/videos/test1.mp4',
    status: ViolationStatus.OPEN, detectedAt: '2026-04-22T16:55:00Z', createdAt: '2026-04-22T16:55:00Z',
  },
  {
    id: 'viol-003', cameraId: 'cam-005', cameraName: 'Lối đi tầng hầm P1',
    siteId: 'site-001', siteName: 'Vinhomes Grand Park',
    type: ViolationType.SAFETY_VEST, severity: Severity.HIGH, confidence: 0.89,
    bboxData: [{ x: 150, y: 200, width: 70, height: 130, label: 'no_vest', confidence: 0.89 }],
    snapshotUrl: '/snapshots/violation_20260427-163811.jpg', clipUrl: '/videos/test1.mp4',
    status: ViolationStatus.UNDER_REVIEW, detectedAt: '2026-04-22T16:45:12Z', createdAt: '2026-04-22T16:45:12Z',
  },
  {
    id: 'viol-004', cameraId: 'cam-006', cameraName: 'Sân thượng - Khu vực hàn',
    siteId: 'site-001', siteName: 'Vinhomes Grand Park',
    type: ViolationType.SAFETY_HARNESS, severity: Severity.CRITICAL, confidence: 0.92,
    bboxData: [{ x: 400, y: 150, width: 90, height: 160, label: 'no_harness', confidence: 0.92 }],
    snapshotUrl: '/snapshots/violation_20260427-163812.jpg', clipUrl: '/videos/test1.mp4',
    status: ViolationStatus.OPEN, detectedAt: '2026-04-22T16:30:00Z', createdAt: '2026-04-22T16:30:00Z',
  },
  {
    id: 'viol-005', cameraId: 'cam-010', cameraName: 'Khu vực đào móng',
    siteId: 'site-003', siteName: 'Lumière Riverside',
    type: ViolationType.FALL_DETECTED, severity: Severity.CRITICAL, confidence: 0.87,
    bboxData: [{ x: 200, y: 300, width: 100, height: 80, label: 'fall_event', confidence: 0.87 }],
    snapshotUrl: '/snapshots/violation_20260427-163813.jpg', clipUrl: '/videos/test1.mp4',
    status: ViolationStatus.OPEN, detectedAt: '2026-04-22T16:20:00Z', createdAt: '2026-04-22T16:20:00Z',
  },
  {
    id: 'viol-006', cameraId: 'cam-011', cameraName: 'Cẩu tháp #2 - Vùng cấm',
    siteId: 'site-003', siteName: 'Lumière Riverside', zoneId: 'zone-003', zoneName: 'Vùng treo tải',
    type: ViolationType.SUSPENDED_LOAD, severity: Severity.CRITICAL, confidence: 0.94,
    bboxData: [{ x: 180, y: 260, width: 55, height: 130, label: 'person_under_load', confidence: 0.94 }],
    snapshotUrl: '/snapshots/violation_20260427-163814.jpg', clipUrl: '/videos/test1.mp4',
    status: ViolationStatus.OPEN, detectedAt: '2026-04-22T16:10:00Z', createdAt: '2026-04-22T16:10:00Z',
  },
  {
    id: 'viol-007', cameraId: 'cam-008', cameraName: 'Tầng 8 - Đổ bê tông',
    siteId: 'site-002', siteName: 'Masteri Centre Point',
    type: ViolationType.HARD_HAT, severity: Severity.HIGH, confidence: 0.91,
    bboxData: [{ x: 320, y: 190, width: 75, height: 110, label: 'no_hardhat', confidence: 0.91 }],
    snapshotUrl: '/snapshots/violation_20260427-163815.jpg', clipUrl: '/videos/test1.mp4',
    status: ViolationStatus.RESOLVED, detectedAt: '2026-04-22T15:30:00Z', createdAt: '2026-04-22T15:30:00Z',
  },
  {
    id: 'viol-008', cameraId: 'cam-009', cameraName: 'Khu vực giàn giáo phía Đông',
    siteId: 'site-002', siteName: 'Masteri Centre Point',
    type: ViolationType.SAFETY_HARNESS, severity: Severity.CRITICAL, confidence: 0.95,
    bboxData: [{ x: 280, y: 140, width: 80, height: 170, label: 'no_harness', confidence: 0.95 }],
    snapshotUrl: '/snapshots/violation_20260427-163816.jpg', clipUrl: '/videos/test1.mp4',
    status: ViolationStatus.OPEN, detectedAt: '2026-04-22T15:15:00Z', createdAt: '2026-04-22T15:15:00Z',
  },
];

export function getMockViolation(id: string): Violation | undefined {
  return mockViolations.find((v) => v.id === id);
}

export function getMockViolationsBySite(siteId: string): Violation[] {
  return mockViolations.filter((v) => v.siteId === siteId);
}
