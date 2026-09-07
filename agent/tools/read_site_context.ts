// SPDX-License-Identifier: MIT
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import { safeRun } from '../lib/tool-context';
import type { ToolContext } from '../lib/tool-context';

export async function siteContext(siteId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId }, include: { cameras: true, alertRules: { where: { isActive: true } } } });
  if (!site) return null;
  return {
    siteId: site.id, name: site.name, address: site.address, status: site.status.toLowerCase(),
    cameras: site.cameras.map(c => ({ id: c.id, name: c.name, status: c.status.toLowerCase(), location: c.location })),
    alertRules: site.alertRules.map(r => ({ id: r.id, name: r.name, channels: JSON.parse(r.channels), violationTypes: JSON.parse(r.violationTypes), recipients: (JSON.parse(r.recipients) as string[]).length, threshold: r.threshold, cooldownSec: r.cooldownSec })),
  };
}

export const makeReadSiteContext = (ctx: ToolContext) => betaZodTool({
  name: 'read_site_context',
  description: 'Công trường: danh sách camera (id, trạng thái), quy tắc cảnh báo đang bật và số người nhận Telegram.',
  inputSchema: z.object({ siteId: z.string() }),
  run: async ({ siteId }) => safeRun(ctx, 'read_site_context', async () => {
    ctx.spent.calls++;
    const data = await siteContext(siteId);
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: 'site', subjectId: siteId, type: 'tool.call', data: { tool: 'read_site_context', found: !!data } });
    return JSON.stringify(data ?? { error: 'không có công trường này' });
  }),
});
