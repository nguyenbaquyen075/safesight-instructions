// SPDX-License-Identifier: MIT
import type { Prisma, Violation as ViolationRow } from '@prisma/client';
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
    reviewFeedback: parseJsonOr(v.reviewFeedback, null),
    detectedAt: v.detectedAt.toISOString(),
    createdAt: v.createdAt.toISOString(),
  };
}

export interface ViolationFilters {
  siteId?: string | null;
  type?: string | null;
  severity?: string | null;
  status?: string | null;
}

// Dựng where cho GET /api/violations: lọc ngay trong SQL thay vì tải cả bảng rồi lọc bằng JS.
// allowedSites = null nghĩa là vai trò toàn tổ chức (không giới hạn site).
// Trả null khi user xin một site ngoài phạm vi được giao -> caller trả 403.
// Chỉ status được viết HOA (DB lưu HOA, API dùng chữ thường); type/severity lưu
// đúng chữ thường như src/types/enums.ts nên giữ nguyên.
export function buildViolationWhere(
  filters: ViolationFilters,
  allowedSites: string[] | null,
): Prisma.ViolationWhereInput | null {
  if (filters.siteId && allowedSites && !allowedSites.includes(filters.siteId)) return null;

  return {
    ...(filters.siteId
      ? { siteId: filters.siteId }
      : allowedSites
        ? { siteId: { in: allowedSites } }
        : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.severity ? { severity: filters.severity } : {}),
    ...(filters.status ? { status: filters.status.toUpperCase() } : {}),
  };
}
