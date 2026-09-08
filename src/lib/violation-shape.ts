// SPDX-License-Identifier: MIT
import type { Violation as ViolationRow } from '@prisma/client';
import type { Violation } from '@/types/models';

// JSON lưu trong cột text có thể hỏng (ghi dở, sửa tay): trả fallback thay vì làm 500 cả danh sách.
export function parseJsonOr<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

// Một chỗ duy nhất đổi row Prisma -> DTO cho GET /api/violations và GET /api/violations/[id].
// DB lưu status chữ HOA, API trả chữ thường.
export function toViolationDTO(v: ViolationRow & { camera: { name: string }; site: { name: string } }): Violation {
  return {
    id: v.id,
    cameraId: v.cameraId,
    cameraName: v.camera.name,
    siteId: v.siteId,
    siteName: v.site.name,
    zoneId: v.zoneId ?? undefined,
    type: v.type as Violation['type'],
    severity: v.severity as Violation['severity'],
    confidence: v.confidence,
    occurrenceCount: v.occurrenceCount,
    bboxData: parseJsonOr(v.bboxData, []),
    snapshotUrl: v.snapshotUrl,
    clipUrl: v.clipUrl ?? undefined,
    status: v.status.toLowerCase() as Violation['status'],
    agentReview: parseJsonOr(v.agentReview, null),
    detectedAt: v.detectedAt.toISOString(),
    createdAt: v.createdAt.toISOString(),
  };
}
