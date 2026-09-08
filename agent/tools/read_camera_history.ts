// SPDX-License-Identifier: MIT
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import { safeRun } from '../lib/tool-context';
import type { ToolContext } from '../lib/tool-context';

export async function cameraHistory(cameraId: string, hours: number) {
  const camera = await prisma.camera.findUnique({ where: { id: cameraId } });
  if (!camera) return null;
  const since = new Date(Date.now() - hours * 3_600_000);
  const rows = await prisma.violation.findMany({ where: { cameraId, detectedAt: { gte: since } }, orderBy: { detectedAt: 'desc' }, take: 200 });
  const fp = rows.filter(r => r.status === 'FALSE_POSITIVE').length;
  const byHour: Record<string, number> = {};
  for (const r of rows) { const h = String(r.detectedAt.getHours()).padStart(2, '0'); byHour[h] = (byHour[h] ?? 0) + 1; }
  const lastHealth = await prisma.agentEvent.findFirst({ where: { type: 'health', subjectType: 'camera', subjectId: cameraId }, orderBy: { emittedAt: 'desc' } });
  return {
    cameraId, name: camera.name, siteId: camera.siteId, status: camera.status.toLowerCase(), source: camera.rtspUrl,
    hours, total: rows.length, falsePositive: fp, falsePositiveRate: rows.length ? Math.round((fp / rows.length) * 100) / 100 : 0,
    byHour, recent: rows.slice(0, 20).map(r => ({ id: r.id, type: r.type, status: r.status.toLowerCase(), occurrenceCount: r.occurrenceCount, detectedAt: r.detectedAt.toISOString() })),
    lastHealth: lastHealth ? JSON.parse(lastHealth.data) : null,
  };
}

export const makeReadCameraHistory = (ctx: ToolContext) => betaZodTool({
  name: 'read_camera_history',
  description: 'Vi phạm của một camera trong N giờ: tổng, tỉ lệ đã đánh dấu báo oan, giờ cao điểm, 20 vi phạm gần nhất (có id), sức khoẻ gần nhất. Trả siteId.',
  inputSchema: z.object({ cameraId: z.string(), hours: z.number().int().min(1).max(720).default(168) }),
  run: async ({ cameraId, hours }) => safeRun(ctx, 'read_camera_history', async () => {
    ctx.spent.calls++;
    const data = await cameraHistory(cameraId, hours);
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: 'camera', subjectId: cameraId, type: 'tool.call', data: { tool: 'read_camera_history', hours, found: !!data } });
    return JSON.stringify(data ?? { error: 'không có camera này' });
  }),
});
