// SPDX-License-Identifier: MIT

import { z } from 'zod';
import { parseJsonOr } from '@/lib/violation-shape';
import type { ReviewFeedback } from '@/types/agent';

// Người xác nhận phán quyết của agent đúng hay sai. Ghi chú giới hạn 300 ký tự: đủ để
// nói "người có mũ, khuất sau cột" mà không biến cột JSON thành nơi lưu văn bản dài.
export const reviewFeedbackSchema = z.object({
  correct: z.boolean(),
  note: z.string().trim().max(300).optional(),
});
export type ReviewFeedbackInput = z.infer<typeof reviewFeedbackSchema>;

/** Ghi phản hồi kèm NGƯỜI chấm: giao diện phải nói rõ ai đã đánh giá, không phải "bạn".
 *  Người dùng không có tên lẫn email thì bỏ hẳn `userName` — dòng cũ hiện "Đã đánh giá lúc …". */
export function buildReviewFeedback(
  input: ReviewFeedbackInput,
  user: { id: string; name?: string | null; email?: string | null },
  at: Date = new Date(),
): ReviewFeedback {
  const userName = user.name ?? user.email ?? undefined;
  return {
    correct: input.correct,
    ...(input.note ? { note: input.note } : {}),
    userId: user.id,
    ...(userName ? { userName } : {}),
    at: at.toISOString(),
  };
}

export interface AccuracyBucket {
  reviewed: number;      // vi phạm agent đã phán quyết
  withFeedback: number;  // trong đó số vi phạm người đã xác nhận đúng/sai
  wrong: number;         // người bảo agent sai
}
export interface CameraAccuracy extends AccuracyBucket { cameraId: string; name: string }
export interface TypeAccuracy extends AccuracyBucket { type: string }
export interface AgentAccuracy {
  totals: AccuracyBucket;
  byCamera: CameraAccuracy[];
  byType: TypeAccuracy[];
}

export interface AccuracyInputRow {
  cameraId: string;
  cameraName: string;
  type: string;
  agentReview: string | null;
  reviewFeedback: string | null;
}

/** Phản hồi hợp lệ = JSON đọc được và có `correct` là boolean. JSON hỏng (sửa tay trong DB)
 *  bị bỏ qua thay vì tính thành "agent đúng" — không bịa ra số liệu tốt hơn thực tế. */
function feedbackOf(raw: string | null): ReviewFeedback | null {
  const parsed = parseJsonOr<Partial<ReviewFeedback> | null>(raw, null);
  return parsed && typeof parsed.correct === 'boolean' ? (parsed as ReviewFeedback) : null;
}

/** Độ chính xác của agent theo camera và theo loại vi phạm — phần thuần của
 *  GET /api/stats/agent-accuracy. Chỉ đếm vi phạm agent ĐÃ phán quyết: vi phạm chưa review
 *  không nói được gì về độ chính xác. Tỉ lệ sai để giao diện tự tính (wrong / withFeedback)
 *  vì mẫu số bằng 0 phải hiện "chưa có phản hồi" chứ không phải 0 %. */
export function agentAccuracy(rows: AccuracyInputRow[]): AgentAccuracy {
  const totals: AccuracyBucket = { reviewed: 0, withFeedback: 0, wrong: 0 };
  const byCamera = new Map<string, CameraAccuracy>();
  const byType = new Map<string, TypeAccuracy>();

  for (const row of rows) {
    if (!row.agentReview) continue;
    const feedback = feedbackOf(row.reviewFeedback);
    const camera = byCamera.get(row.cameraId) ?? { cameraId: row.cameraId, name: row.cameraName, reviewed: 0, withFeedback: 0, wrong: 0 };
    const type = byType.get(row.type) ?? { type: row.type, reviewed: 0, withFeedback: 0, wrong: 0 };

    for (const bucket of [totals, camera, type]) {
      bucket.reviewed += 1;
      if (feedback) bucket.withFeedback += 1;
      if (feedback && !feedback.correct) bucket.wrong += 1;
    }
    byCamera.set(row.cameraId, camera);
    byType.set(row.type, type);
  }

  // Sai nhiều nhất lên đầu (chỗ cần xem trước), rồi review nhiều, rồi tên/loại tăng dần —
  // thứ tự dòng trong DB không được làm bảng nhảy giữa hai lần tải.
  const rank = (a: AccuracyBucket, b: AccuracyBucket) => b.wrong - a.wrong || b.reviewed - a.reviewed;
  return {
    totals,
    byCamera: [...byCamera.values()].sort((a, b) => rank(a, b) || a.name.localeCompare(b.name, 'vi')),
    byType: [...byType.values()].sort((a, b) => rank(a, b) || a.type.localeCompare(b.type)),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 30;
const MAX_DAYS = 366; // trần để một URL cố ý xin 10 năm không quét cả bảng

/** Khoảng ngày dùng chung của GET /api/stats/agent-accuracy và GET /api/reports/agent-feedback:
 *  lấy TRỌN ngày đầu/cuối theo UTC (cùng quy ước với /api/stats/compliance), ngày hỏng thì rơi
 *  về mặc định 30 ngày, from sau to thì thu về to. */
export function accuracyRange(fromRaw: string | null, toRaw: string | null, now: number = Date.now()): { gte: Date; lte: Date } {
  const parse = (raw: string | null, fallback: number) => {
    const ts = raw ? Date.parse(raw) : NaN;
    return new Date(Number.isNaN(ts) ? fallback : ts);
  };
  const to = parse(toRaw, now);
  let from = parse(fromRaw, now - (DEFAULT_DAYS - 1) * DAY_MS);
  if (from > to) from = to;
  if (to.getTime() - from.getTime() > MAX_DAYS * DAY_MS) from = new Date(to.getTime() - MAX_DAYS * DAY_MS);
  return {
    gte: new Date(`${from.toISOString().slice(0, 10)}T00:00:00.000Z`),
    lte: new Date(`${to.toISOString().slice(0, 10)}T23:59:59.999Z`),
  };
}

// Trần số dòng cho cả hai truy vấn phản hồi (thống kê và CSV): file để nạp vào training/ và
// một thẻ trên trang, không phải kho lưu trữ — 20k dòng đã là vài tháng phản hồi.
export const MAX_FEEDBACK_ROWS = 20_000;

export const AGENT_FEEDBACK_CSV_HEADER = ['violationId', 'cameraId', 'type', 'detectedAt', 'snapshotUrl', 'clipUrl', 'agentVerdict', 'band', 'humanCorrect', 'note'] as const;

/** Một dòng CSV: bọc nháy kép mọi ô nên dấu phẩy, nháy và xuống dòng đều an toàn.
 *  Ô mở đầu bằng = + - @ được thêm nháy đơn dẫn đầu — Excel/Sheets coi đó là công thức. */
export function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells
    .map(c => {
      const text = c === null || c === undefined ? '' : String(c);
      return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
    })
    .join(',');
}
