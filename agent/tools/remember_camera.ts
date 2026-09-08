// SPDX-License-Identifier: MIT
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { emit } from '../lib/audit';
import { safeRun } from '../lib/tool-context';
import type { ToolContext } from '../lib/tool-context';
import { MEMORY_MAX, NOTE_MAX, rememberCamera } from '../lib/camera-agent';
import { LIMITS } from '../lib/guard';

export const makeRememberCamera = (ctx: ToolContext) => betaZodTool({
  name: 'remember_camera',
  description: 'Ghi một điều BỀN về camera này để các phiên sau dùng lại (góc máy, giờ ngược sáng, khu vực hay báo oan, việc cần theo dõi). Không dùng cho một vi phạm cụ thể (dùng write_note). Tối đa 300 ký tự, 3 lần/phiên.',
  inputSchema: z.object({
    text: z.string().min(5).max(NOTE_MAX),
    replaceIndex: z.number().int().min(0).max(MEMORY_MAX - 1).optional(),
  }),
  run: async ({ text, replaceIndex }) => safeRun(ctx, 'remember_camera', async () => {
    ctx.spent.calls++;
    if (!ctx.cameraId) return JSON.stringify({ ok: false, blockedReason: 'phiên này không thuộc camera nào' });
    if (ctx.spent.remembers >= LIMITS.rememberPerSession) return JSON.stringify({ ok: false, blockedReason: 'phiên này đã ghi trí nhớ đủ số lần' });
    const notes = await rememberCamera(ctx.cameraId, text, ctx.sessionId, replaceIndex);
    ctx.spent.remembers++;
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: 'camera', subjectId: ctx.cameraId, type: 'action', data: { action: 'remember_camera', text, replaceIndex, total: notes.length } });
    return JSON.stringify({ ok: true, total: notes.length });
  }),
});
