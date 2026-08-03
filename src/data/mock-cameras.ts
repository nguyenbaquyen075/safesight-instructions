// SPDX-License-Identifier: MIT

/* ===== SafeSight AI — Mock Data: Cameras ===== */

import { CameraStatus } from '@/types/enums';
import type { Camera } from '@/types/models';

export const mockCameras: Camera[] = [
  // Site 001 - Vinhomes Grand Park
  { id: 'cam-001', siteId: 'site-001', siteName: 'Vinhomes Grand Park', name: 'Cổng chính - Entrance A', rtspUrl: 'rtsp://192.168.1.101:554/stream1', status: CameraStatus.ONLINE, type: 'dome', location: 'Main Entrance', fps: 15, resolution: '1920x1080', lastHealthCheck: '2026-04-22T17:00:00Z', lastDetectionAt: '2026-04-22T16:58:23Z', thumbnailUrl: '/snapshots/violation_20260427-cam-entrance.jpg', videoUrl: '/videos/test1.mp4', createdAt: '2026-01-15T08:00:00Z' },
  { id: 'cam-002', siteId: 'site-001', siteName: 'Vinhomes Grand Park', name: 'Tầng 15 - Khu vực cốt thép', rtspUrl: 'rtsp://192.168.1.102:554/stream1', status: CameraStatus.ONLINE, type: 'fixed', location: 'Floor 15 - Rebar Area', fps: 15, resolution: '1920x1080', lastHealthCheck: '2026-04-22T17:00:00Z', lastDetectionAt: '2026-04-22T17:01:12Z', thumbnailUrl: '/snapshots/violation_20260427-cam-rebar.jpg', videoUrl: '/videos/test1.mp4', createdAt: '2026-01-15T08:00:00Z' },
  { id: 'cam-003', siteId: 'site-001', siteName: 'Vinhomes Grand Park', name: 'Khu vực cẩu tháp #1', rtspUrl: 'rtsp://192.168.1.103:554/stream1', status: CameraStatus.ONLINE, type: 'ptz', location: 'Tower Crane #1 Zone', fps: 10, resolution: '2560x1440', lastHealthCheck: '2026-04-22T17:00:00Z', lastDetectionAt: '2026-04-22T16:55:00Z', thumbnailUrl: '/snapshots/violation_20260427-cam-crane.jpg', videoUrl: '/videos/test1.mp4', createdAt: '2026-01-15T08:00:00Z' },
  { id: 'cam-004', siteId: 'site-001', siteName: 'Vinhomes Grand Park', name: 'Kho vật liệu B2', rtspUrl: 'rtsp://192.168.1.104:554/stream1', status: CameraStatus.OFFLINE, type: 'bullet', location: 'Material Storage B2', fps: 0, resolution: '1920x1080', lastHealthCheck: '2026-04-22T14:30:00Z', thumbnailUrl: '/snapshots/violation_20260427-cam-storage.jpg', createdAt: '2026-01-15T08:00:00Z' },
  { id: 'cam-005', siteId: 'site-001', siteName: 'Vinhomes Grand Park', name: 'Lối đi tầng hầm P1', rtspUrl: 'rtsp://192.168.1.105:554/stream1', status: CameraStatus.ONLINE, type: 'dome', location: 'Basement P1 Walkway', fps: 15, resolution: '1920x1080', lastHealthCheck: '2026-04-22T17:00:00Z', lastDetectionAt: '2026-04-22T17:02:00Z', thumbnailUrl: '/snapshots/violation_20260427-cam-basement.jpg', createdAt: '2026-01-20T08:00:00Z' },
  { id: 'cam-006', siteId: 'site-001', siteName: 'Vinhomes Grand Park', name: 'Sân thượng - Khu vực hàn', rtspUrl: 'rtsp://192.168.1.106:554/stream1', status: CameraStatus.DEGRADED, type: 'fixed', location: 'Rooftop - Welding Area', fps: 8, resolution: '1920x1080', lastHealthCheck: '2026-04-22T17:00:00Z', lastDetectionAt: '2026-04-22T16:50:00Z', thumbnailUrl: '/snapshots/violation_20260427-cam-welding.jpg', createdAt: '2026-01-20T08:00:00Z' },

  // Site 002 - Masteri Centre Point
  { id: 'cam-007', siteId: 'site-002', siteName: 'Masteri Centre Point', name: 'Cổng vào công trường', rtspUrl: 'rtsp://192.168.2.101:554/stream1', status: CameraStatus.ONLINE, type: 'dome', location: 'Site Gate', fps: 15, resolution: '1920x1080', lastHealthCheck: '2026-04-22T17:00:00Z', lastDetectionAt: '2026-04-22T17:00:45Z', thumbnailUrl: '/snapshots/violation_20260427-cam-gate.jpg', createdAt: '2026-02-01T08:00:00Z' },
  { id: 'cam-008', siteId: 'site-002', siteName: 'Masteri Centre Point', name: 'Tầng 8 - Đổ bê tông', rtspUrl: 'rtsp://192.168.2.102:554/stream1', status: CameraStatus.ONLINE, type: 'fixed', location: 'Floor 8 - Concrete Pour', fps: 15, resolution: '1920x1080', lastHealthCheck: '2026-04-22T17:00:00Z', lastDetectionAt: '2026-04-22T16:59:30Z', thumbnailUrl: '/snapshots/violation_20260427-cam-concrete.jpg', createdAt: '2026-02-01T08:00:00Z' },
  { id: 'cam-009', siteId: 'site-002', siteName: 'Masteri Centre Point', name: 'Khu vực giàn giáo phía Đông', rtspUrl: 'rtsp://192.168.2.103:554/stream1', status: CameraStatus.ONLINE, type: 'bullet', location: 'East Scaffolding', fps: 10, resolution: '1920x1080', lastHealthCheck: '2026-04-22T17:00:00Z', lastDetectionAt: '2026-04-22T16:57:00Z', thumbnailUrl: '/snapshots/violation_20260427-cam-scaffold.jpg', createdAt: '2026-02-05T08:00:00Z' },

  // Site 003 - Lumière Riverside
  { id: 'cam-010', siteId: 'site-003', siteName: 'Lumière Riverside', name: 'Khu vực đào móng', rtspUrl: 'rtsp://192.168.3.101:554/stream1', status: CameraStatus.ONLINE, type: 'ptz', location: 'Excavation Zone', fps: 15, resolution: '2560x1440', lastHealthCheck: '2026-04-22T17:00:00Z', lastDetectionAt: '2026-04-22T17:01:00Z', thumbnailUrl: '/snapshots/violation_20260427-cam-excavation.jpg', createdAt: '2026-02-15T08:00:00Z' },
  { id: 'cam-011', siteId: 'site-003', siteName: 'Lumière Riverside', name: 'Cẩu tháp #2 - Vùng cấm', rtspUrl: 'rtsp://192.168.3.102:554/stream1', status: CameraStatus.ONLINE, type: 'fixed', location: 'Crane #2 Exclusion Zone', fps: 15, resolution: '1920x1080', lastHealthCheck: '2026-04-22T17:00:00Z', lastDetectionAt: '2026-04-22T17:00:15Z', thumbnailUrl: '/snapshots/violation_20260427-cam-crane2.jpg', createdAt: '2026-02-15T08:00:00Z' },
  { id: 'cam-012', siteId: 'site-003', siteName: 'Lumière Riverside', name: 'Đường nội bộ công trường', rtspUrl: 'rtsp://192.168.3.103:554/stream1', status: CameraStatus.OFFLINE, type: 'dome', location: 'Internal Road', fps: 0, resolution: '1920x1080', lastHealthCheck: '2026-04-22T12:00:00Z', thumbnailUrl: '/snapshots/violation_20260427-cam-road.jpg', createdAt: '2026-02-20T08:00:00Z' },
];

export function getMockCamera(id: string): Camera | undefined {
  return mockCameras.find((c) => c.id === id);
}

export function getMockCamerasBySite(siteId: string): Camera[] {
  return mockCameras.filter((c) => c.siteId === siteId);
}
