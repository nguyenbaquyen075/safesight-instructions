// SPDX-License-Identifier: MIT
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { emit } from '../lib/audit';
import { safeRun } from '../lib/tool-context';
import type { ToolContext } from '../lib/tool-context';

export const makeWriteNote = (ctx: ToolContext) => betaZodTool({
  name: 'write_note',
  description: 'Ghi một nhận xét ngắn gắn vào vi phạm/camera/công trường (hiện trên panel Agent). Không đổi trạng thái gì.',
  inputSchema: z.object({ subjectType: z.enum(['violation', 'camera', 'site', 'system']), subjectId: z.string().optional(), note: z.string().min(5).max(800) }),
  run: async ({ subjectType, subjectId, note }) => safeRun(ctx, 'write_note', async () => {
    ctx.spent.calls++;
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType, subjectId: subjectId ?? null, type: 'message.assistant', data: { note } });
    return JSON.stringify({ ok: true });
  }),
});
