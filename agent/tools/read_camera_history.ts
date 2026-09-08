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
  // Người chấm phán quyết của agent đúng/sai trong 7 ngày (khung cố định, không theo `hours`):
  // camera hay bị đánh sai thì subagent phải dè dặt hơn khi chốt VERIFIED.
  const feedbackRows = await prisma.violation.findMany({
    where: { cameraId, detectedAt: { gte: new Date(Date.now() - 7 * 24 * 3_600_000) }, reviewFeedback: { not: null } },
    select: { reviewFeedback: true },
  });
  const feedbacks = feedbackRows.map(r => { try { return JSON.parse(r.reviewFeedback!) as { correct?: unknown }; } catch { return null; } })
    .filter(f => f !== null && typeof f.correct === 'boolean') as { correct: boolean }[];
  const wrong = feedbacks.filter(f => !f.correct).length;
  return {
    agentFeedback: { total: feedbacks.length, wrong, wrongRate: Math.round((wrong / Math.max(feedbacks.length, 1)) * 100) / 100 },
    cameraId, name: camera.name, siteId: camera.siteId, status: camera.status.toLowerCase(), source: camera.rtspUrl,
    hours, total: rows.length, falsePositive: fp, falsePositiveRate: rows.length ? Math.round((fp / rows.length) * 100) / 100 : 0,
    byHour, recent: rows.slice(0, 20).map(r => ({ id: r.id, type: r.type, status: r.status.toLowerCase(), occurrenceCount: r.occurrenceCount, detectedAt: r.detectedAt.toISOString() })),
    lastHealth: lastHealth ? JSON.parse(lastHealth.data) : null,
  };
}

export const makeReadCameraHistory = (ctx: ToolContext) => betaZodTool({
  name: 'read_camera_history',
  description: 'Vi phạm của một camera trong N giờ: tổng, tỉ lệ đã đánh dấu báo oan, giờ cao điểm, 20 vi phạm gần nhất (có id), sức khoẻ gần nhất, phản hồi của người về phán quyết agent 7 ngày (agentFeedback.wrongRate). Trả siteId.',
  inputSchema: z.object({ cameraId: z.string(), hours: z.number().int().min(1).max(720).default(168) }),
  run: async ({ cameraId, hours }) => safeRun(ctx, 'read_camera_history', async () => {
    ctx.spent.calls++;
    const data = await cameraHistory(cameraId, hours);
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: 'camera', subjectId: cameraId, type: 'tool.call', data: { tool: 'read_camera_history', hours, found: !!data } });
    return JSON.stringify(data ?? { error: 'không có camera này' });
  }),
});
