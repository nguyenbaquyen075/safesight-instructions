// SPDX-License-Identifier: MIT

import { z } from 'zod';

// Engine gửi mỗi phút một dòng cho mỗi camera. Trần 200 dòng/lần đủ cho ~200 luồng
// hoặc vài phút dồn lại khi dashboard vừa khởi động lại, mà body vẫn nhỏ.
export const MAX_OBSERVATIONS_PER_REQUEST = 200;

export const observationSchema = z.object({
  cameraId: z.string().min(1),
  // Mốc PHÚT dạng ISO (giây/mili luôn bằng 0) — khoá upsert cùng cameraId.
  minute: z.string().datetime(),
  // Số người ĐÔNG NHẤT thấy trong phút đó (đã lọc theo vùng làm việc ở engine).
  persons: z.number().int().min(0),
  // "Người × giây": 2 người trong 30s = 60. Nền để quy ra person-minutes.
  personSeconds: z.number().min(0),
});

export const observationsPayloadSchema = z.object({
  observations: z.array(observationSchema).min(1).max(MAX_OBSERVATIONS_PER_REQUEST),
});

export type ObservationInput = z.infer<typeof observationSchema>;

export interface ComplianceDay {
  day: string;            // YYYY-MM-DD (UTC, cùng quy ước với use-dashboard.ts)
  personMinutes: number;
  violations: number;
  complianceRate: number | null; // 0–1; null = ngày chưa có quan sát nào
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (value: Date | string) => new Date(value).toISOString().slice(0, 10);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Tỉ lệ tuân thủ THẬT theo ngày: 1 − vi_phạm / số_phút_người quan sát được.
 *
 *  personMinutes là mẫu số có ý nghĩa (10 người làm 1 giờ = 600 phút-người), khác
 *  hẳn cách ước lượng cũ `rateFromCount` (trừ đều 5 điểm mỗi vi phạm). Ngày không
 *  có dòng ObservationStat nào -> complianceRate = null để giao diện biết là "chưa
 *  đủ dữ liệu quan sát" thay vì hiện 100% giả.
 */
export function complianceByDay(
  stats: { minute: Date | string; personSeconds: number }[],
  violations: { detectedAt: Date | string }[],
  from: Date | string,
  to: Date | string,
): ComplianceDay[] {
  const secondsByDay = new Map<string, number>();
  stats.forEach(s => secondsByDay.set(dayKey(s.minute), (secondsByDay.get(dayKey(s.minute)) ?? 0) + s.personSeconds));

  const violationsByDay = new Map<string, number>();
  violations.forEach(v => violationsByDay.set(dayKey(v.detectedAt), (violationsByDay.get(dayKey(v.detectedAt)) ?? 0) + 1));

  const start = Date.parse(`${dayKey(from)}T00:00:00.000Z`);
  const end = Date.parse(`${dayKey(to)}T00:00:00.000Z`);
  const days: ComplianceDay[] = [];
  for (let t = start; t <= end; t += DAY_MS) {
    const day = new Date(t).toISOString().slice(0, 10);
    const personMinutes = Math.round((secondsByDay.get(day) ?? 0) / 60);
    const violationCount = violationsByDay.get(day) ?? 0;
    days.push({
      day,
      personMinutes,
      violations: violationCount,
      // max(personMinutes, 1): 1 phút-người mà có 3 vi phạm thì rate về 0, không âm.
      complianceRate: personMinutes === 0 ? null : clamp01(1 - violationCount / Math.max(personMinutes, 1)),
    });
  }
  return days;
}
