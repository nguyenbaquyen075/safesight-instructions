// SPDX-License-Identifier: MIT
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { capabilities } from '../lib/capabilities';
import { emit } from '../lib/audit';
import { safeRun } from '../lib/tool-context';
import type { ToolContext } from '../lib/tool-context';

export async function systemHealth() {
  const recent = await prisma.agentEvent.findMany({ where: { type: 'health', emittedAt: { gte: new Date(Date.now() - 15 * 60_000) } }, orderBy: { emittedAt: 'desc' }, take: 50 });
  return { capabilities: await capabilities(), recentFindings: recent.map(e => ({ at: e.emittedAt.toISOString(), subjectId: e.subjectId, ...JSON.parse(e.data) })) };
}

export const makeReadSystemHealth = (ctx: ToolContext) => betaZodTool({
  name: 'read_system_health',
  description: 'Sức khoẻ hệ thống 15 phút gần nhất: capability nào đang bật, phát hiện của trực vận hành (camera đứng, engine đứng, đĩa đầy...).',
  inputSchema: z.object({}),
  run: async () => safeRun(ctx, 'read_system_health', async () => {
    ctx.spent.calls++;
    const data = await systemHealth();
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, type: 'tool.call', data: { tool: 'read_system_health' } });
    return JSON.stringify(data);
  }),
});
