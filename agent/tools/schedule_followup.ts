// SPDX-License-Identifier: MIT
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { emit } from '../lib/audit';
import { checkPaused, LIMITS } from '../lib/guard';
import { PRIORITY, scheduleTask } from '../lib/tasks';
import { safeRun } from '../lib/tool-context';
import type { ToolContext } from '../lib/tool-context';

export const makeScheduleFollowup = (ctx: ToolContext) => betaZodTool({
  name: 'schedule_followup',
  description: 'Hẹn xem lại một chủ thể sau N phút và nói vì sao (người quản lý đọc lý do này). Dùng khi chưa kết luận được hoặc muốn tổng hợp camera sau.',
  inputSchema: z.object({
    kind: z.enum(['followup', 'camera.digest']),
    subjectType: z.enum(['violation', 'camera', 'site', 'system']),
    subjectId: z.string().optional(),
    minutes: z.number().int().min(5).max(1440),
    reason: z.string().min(10).max(300).describe("'xem lại camera này sau 30 phút vì ngược sáng buổi chiều', không phải 'hẹn lại'."),
  }),
  run: async ({ kind, subjectType, subjectId, minutes, reason }) => safeRun(ctx, 'schedule_followup', async () => {
    ctx.spent.calls++;
    const paused = await checkPaused();
    if (paused) return JSON.stringify({ scheduled: false, blockedReason: paused.reason });
    if (ctx.spent.followups >= LIMITS.followupPerSession) return JSON.stringify({ scheduled: false, blockedReason: 'phiên này đã hẹn đủ số lần' });
    // Chỉ 'system' mới được thiếu subjectId; thiếu ở chủ thể khác sẽ gộp nhầm mọi camera/vi phạm vào một task subjectId=null.
    if (subjectType !== 'system' && !subjectId) return JSON.stringify({ scheduled: false, blockedReason: 'cần subjectId cho chủ thể này' });
    const dueAt = new Date(Date.now() + minutes * 60_000);
    await scheduleTask({ kind, subjectType, subjectId: subjectId ?? null, reason, dueAt, priority: PRIORITY[kind] });
    ctx.spent.followups++;
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType, subjectId: subjectId ?? null, type: 'action', data: { action: 'schedule_followup', kind, minutes, reason } });
    return JSON.stringify({ scheduled: true, dueAt: dueAt.toISOString(), reason });
  }),
});
