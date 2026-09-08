// SPDX-License-Identifier: MIT
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import { getCameraAgent, rememberCamera } from '../lib/camera-agent';
import { checkPaused, LIMITS } from '../lib/guard';
import { PRIORITY, scheduleTask } from '../lib/tasks';
import { safeRun } from '../lib/tool-context';
import type { ToolContext } from '../lib/tool-context';

// Điều phối: giao một việc cụ thể cho subagent của một camera. Việc thành task `camera.instruction`
// (chạy dưới subagent đó, không bị cổng "không có hoạt động mới" chặn) và được ghi vào trí nhớ camera
// để các phiên sau của camera ấy vẫn nhớ. Đếm chung hạn mức với schedule_followup.
export const makeDispatchToCamera = (ctx: ToolContext) => betaZodTool({
  name: 'dispatch_to_camera',
  description: 'Giao việc cho subagent của MỘT camera: chỉ dẫn cụ thể (subagent đọc nó làm "Lý do" của phiên) và được ghi vào trí nhớ camera. Mặc định chạy ngay; minutes để hẹn sau. Một chỉ dẫn đang chờ cho cùng camera sẽ bị thay bằng chỉ dẫn mới.',
  inputSchema: z.object({
    cameraId: z.string().min(1),
    instruction: z.string().min(10).max(300).describe("'Chiều nay để ý người không mũ ở cổng B, leo thang nếu lặp lại', không phải 'kiểm tra camera'."),
    minutes: z.number().int().min(0).max(1440).optional(),
  }),
  run: async ({ cameraId, instruction, minutes }) => safeRun(ctx, 'dispatch_to_camera', async () => {
    ctx.spent.calls++;
    const paused = await checkPaused();
    if (paused) return JSON.stringify({ dispatched: false, blockedReason: paused.reason });
    if (ctx.spent.followups >= LIMITS.followupPerSession) return JSON.stringify({ dispatched: false, blockedReason: 'phiên này đã giao/hẹn đủ số lần' });
    const camera = await prisma.camera.findUnique({ where: { id: cameraId }, select: { id: true } });
    if (!camera) return JSON.stringify({ dispatched: false, blockedReason: `camera ${cameraId} không tồn tại` });
    const agent = await getCameraAgent(cameraId);
    if (!agent.isEnabled) return JSON.stringify({ dispatched: false, blockedReason: `subagent camera ${cameraId} đang tắt` });
    const dueAt = new Date(Date.now() + (minutes ?? 0) * 60_000);
    const { merged } = await scheduleTask({ kind: 'camera.instruction', subjectType: 'camera', subjectId: cameraId, reason: instruction, dueAt, priority: PRIORITY['camera.instruction'] });
    // Task đã xếp xong; ghi trí nhớ thất bại (xung đột CAS với phiên của chính camera) không được biến lượt giao việc thành lỗi.
    let memoryTotal: number | null = null;
    try { memoryTotal = (await rememberCamera(cameraId, `Chỉ dẫn từ agent trưởng: ${instruction}`, ctx.sessionId)).length; } catch { memoryTotal = null; }
    ctx.spent.followups++;
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: 'camera', subjectId: cameraId, type: 'action', data: { action: 'dispatch_to_camera', instruction, minutes: minutes ?? 0, merged, memoryWritten: memoryTotal !== null } });
    return JSON.stringify({ dispatched: true, dueAt: dueAt.toISOString(), replacedPending: merged, memoryWritten: memoryTotal !== null, memoryTotal });
  }),
});
