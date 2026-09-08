// SPDX-License-Identifier: MIT

import { z } from 'zod';
import type { CorrectiveAction } from '@prisma/client';

// Trạng thái lưu chữ HOA đúng như trong DB (schema.prisma: default "OPEN") và API cũng
// trả chữ HOA — khác Violation (lưu HOA, trả thường) vì ở đây không có enum chữ thường
// nào ở src/types/enums.ts để phải khớp theo.
export const ACTION_STATUSES = ['OPEN', 'DONE', 'CANCELLED'] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

// Việc khắc phục xong chỉ được tự đóng vi phạm khi vi phạm CHƯA được người chốt: người đã
// đánh FALSE_POSITIVE (hoặc RESOLVED) rồi thì máy không được ghi đè phán quyết đó.
export const AUTO_RESOLVABLE_STATUSES = ['OPEN', 'UNDER_REVIEW'] as const;

/** Hạn mặc định khi người giao việc không chọn: 24 giờ kể từ lúc giao. */
export const DEFAULT_DUE_MS = 24 * 3_600_000;

export const createActionSchema = z.object({
  // Người xử lý có thể không có tài khoản (thầu phụ, tổ đội) -> chỉ bắt buộc tên.
  assigneeId: z.string().min(1).optional(),
  assigneeName: z.string().trim().min(2).max(80),
  description: z.string().trim().min(5).max(500),
  // Nhận cả ISO đầy đủ lẫn chuỗi của <input type="datetime-local"> ("2026-09-09T10:00",
  // hiểu theo giờ máy người dùng). Thiếu thì mặc định +24h.
  dueAt: z
    .string()
    .optional()
    .transform((raw) => (raw ? new Date(raw) : new Date(Date.now() + DEFAULT_DUE_MS)))
    .refine((d) => !Number.isNaN(d.getTime()) && d.getTime() > Date.now(), {
      message: 'Hạn xử lý phải là một mốc thời gian ở tương lai',
    }),
});
export type CreateActionInput = z.infer<typeof createActionSchema>;

export const updateActionSchema = z.object({
  status: z.enum(ACTION_STATUSES),
  evidenceNote: z.string().trim().max(500).optional(),
});
export type UpdateActionInput = z.infer<typeof updateActionSchema>;

/** Quá hạn = còn OPEN và đã qua hạn. Việc đã DONE/CANCELLED không bao giờ quá hạn. */
export function isOverdue(action: { status: string; dueAt: Date | string }, now: number | Date = Date.now()): boolean {
  if (action.status !== 'OPEN') return false;
  const due = action.dueAt instanceof Date ? action.dueAt.getTime() : Date.parse(action.dueAt);
  const at = now instanceof Date ? now.getTime() : now;
  return Number.isFinite(due) && due < at;
}

export interface CorrectiveActionDTO {
  id: string;
  violationId: string;
  siteId: string;
  assigneeId?: string;
  assigneeName: string;
  description: string;
  dueAt: string;
  status: ActionStatus;
  evidenceNote?: string;
  completedAt?: string;
  escalatedAt?: string;
  createdAt: string;
  overdue: boolean;
}

/** Row Prisma -> DTO cho web/agent. `status` lạ (sửa tay trong DB) quy về OPEN: việc còn
 *  phải làm là mặc định an toàn, không tự coi là đã khắc phục. */
export function toActionDTO(row: Omit<CorrectiveAction, 'updatedAt'>, now: number | Date = Date.now()): CorrectiveActionDTO {
  const status = (ACTION_STATUSES as readonly string[]).includes(row.status) ? (row.status as ActionStatus) : 'OPEN';
  return {
    id: row.id,
    violationId: row.violationId,
    siteId: row.siteId,
    assigneeId: row.assigneeId ?? undefined,
    assigneeName: row.assigneeName,
    description: row.description,
    dueAt: row.dueAt.toISOString(),
    status,
    evidenceNote: row.evidenceNote ?? undefined,
    completedAt: row.completedAt?.toISOString(),
    escalatedAt: row.escalatedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    overdue: isOverdue({ status, dueAt: row.dueAt }, now),
  };
}
