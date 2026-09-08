// SPDX-License-Identifier: MIT
import type { Violation } from '@/types/models';
import { ViolationStatus } from '@/types/enums';

export interface CameraReportRow {
  cameraId: string;
  cameraName: string;
  siteName: string;
  total: number;
  real: number;
  falsePositive: number;
  open: number;
}

export interface ViolationReport {
  range: { from: string; to: string };
  byCamera: CameraReportRow[];
  rows: Violation[];
}

// Phần thuần của GET /api/reports/violations (route handler cần ngữ cảnh Next
// request + auth() nên không test trực tiếp được, giống violation-where.test.ts).
//
// Quy ước đếm, giữ bất biến total = real + falsePositive + open:
// - real: đã xác nhận là vi phạm thật (RESOLVED)
// - falsePositive: đã kết luận báo oan (FALSE_POSITIVE)
// - open: chưa có kết luận (OPEN và UNDER_REVIEW)
export function buildReportSummary(rows: Violation[]): CameraReportRow[] {
  const byCamera = new Map<string, CameraReportRow>();
  for (const v of rows) {
    let row = byCamera.get(v.cameraId);
    if (!row) {
      row = { cameraId: v.cameraId, cameraName: v.cameraName, siteName: v.siteName, total: 0, real: 0, falsePositive: 0, open: 0 };
      byCamera.set(v.cameraId, row);
    }
    row.total += 1;
    if (v.status === ViolationStatus.RESOLVED) row.real += 1;
    else if (v.status === ViolationStatus.FALSE_POSITIVE) row.falsePositive += 1;
    else row.open += 1;
  }
  // Camera nhiều vi phạm nhất lên đầu; cùng số thì theo tên để thứ tự ổn định giữa các lần tải.
  return [...byCamera.values()].sort((a, b) => b.total - a.total || a.cameraName.localeCompare(b.cameraName, 'vi'));
}
