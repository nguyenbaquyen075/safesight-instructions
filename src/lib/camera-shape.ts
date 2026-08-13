// SPDX-License-Identifier: MIT

import type { Camera as DbCamera } from '@prisma/client';
import type { Camera } from '@/types/models';
import type { CameraStatus } from '@/types/enums';
import cameraVideos from '@/data/camera-videos.json';

// ID các camera DEMO (dùng video mẫu) — các row Camera này trong DB CHỈ tồn tại để
// khớp khoá ngoại (FK) cho Violation demo, rtspUrl của chúng là dữ liệu giả, KHÔNG
// PHẢI camera thật do người dùng thêm qua Settings > Giám sát. Phải loại ra khi liệt
// kê camera thật, khớp với ai-engine/yolo_inference.py (load_real_camera_overrides).
export const DEMO_CAMERA_IDS = new Set(Object.keys(cameraVideos));

/** Chuyển 1 row Camera thật trong DB sang shape Camera dùng ở frontend. */
export function toCameraDTO(c: DbCamera, siteName: string): Camera {
  return {
    id: c.id,
    siteId: c.siteId,
    siteName,
    name: c.name,
    rtspUrl: c.rtspUrl,
    // DB lưu "ONLINE"/"OFFLINE" (khớp default trong schema.prisma), nhưng CameraStatus
    // enum ở frontend là chữ thường ('online'...) — phải chuẩn hoá ở đây, không thì so
    // sánh status === CameraStatus.ONLINE sẽ luôn sai (đã từng gây camera thật không
    // bao giờ hiện "online" dù DB đúng là online).
    status: c.status.toLowerCase() as CameraStatus,
    type: c.type as Camera['type'],
    location: c.location,
    fps: c.fps,
    resolution: c.resolution,
    lastHealthCheck: c.lastHealthCheck.toISOString(),
    lastDetectionAt: c.lastDetectionAt?.toISOString(),
    thumbnailUrl: c.thumbnailUrl ?? undefined,
    createdAt: c.createdAt.toISOString(),
  };
}
