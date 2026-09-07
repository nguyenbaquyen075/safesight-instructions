// SPDX-License-Identifier: MIT
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import { safeRun } from '../lib/tool-context';
import type { ToolContext } from '../lib/tool-context';

export async function agentActivity(hours: number) {
  const since = new Date(Date.now() - hours * 3_600_000);
  const [pending, done, verdicts] = await Promise.all([
    prisma.agentTask.findMany({ where: { finishedAt: null }, orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }], take: 30 }),
    prisma.agentTask.findMany({ where: { finishedAt: { gte: since } }, orderBy: { finishedAt: 'desc' }, take: 30 }),
    prisma.agentEvent.findMany({ where: { type: 'verdict', emittedAt: { gte: since } }, orderBy: { emittedAt: 'desc' }, take: 30 }),
  ]);
  const shape = (t: (typeof pending)[number]) => ({ id: t.id, kind: t.kind, subjectType: t.subjectType, subjectId: t.subjectId, reason: t.reason, dueAt: t.dueAt.toISOString(), outcome: t.outcome });
  return { pending: pending.map(shape), done: done.map(shape), verdicts: verdicts.map(v => ({ at: v.emittedAt.toISOString(), violationId: v.subjectId, ...JSON.parse(v.data) })) };
}

export const makeReadAgentActivity = (ctx: ToolContext) => betaZodTool({
  name: 'read_agent_activity',
  description: 'Agent đã làm gì trong N giờ: task đang chờ, task đã xong (outcome), các phán quyết.',
  inputSchema: z.object({ hours: z.number().int().min(1).max(168).default(24) }),
  run: async ({ hours }) => safeRun(ctx, 'read_agent_activity', async () => {
    ctx.spent.calls++;
    const data = await agentActivity(hours);
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, type: 'tool.call', data: { tool: 'read_agent_activity', hours } });
    return JSON.stringify(data);
  }),
});
