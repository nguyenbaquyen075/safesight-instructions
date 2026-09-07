// SPDX-License-Identifier: MIT
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import { safeRun } from '../lib/tool-context';
import type { ToolContext } from '../lib/tool-context';

export const searchSchema = z.object({
  cameraId: z.string().optional(), siteId: z.string().optional(), type: z.string().optional(),
  status: z.enum(['open', 'under_review', 'resolved', 'false_positive']).optional(),
  from: z.string().datetime().optional(), to: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(30),
});

export async function searchViolations(f: z.infer<typeof searchSchema>) {
  const rows = await prisma.violation.findMany({
    where: {
      cameraId: f.cameraId, siteId: f.siteId, type: f.type, status: f.status ? f.status.toUpperCase() : undefined,
      detectedAt: { gte: f.from ? new Date(f.from) : undefined, lte: f.to ? new Date(f.to) : undefined },
    },
    orderBy: { detectedAt: 'desc' }, take: f.limit, include: { camera: { select: { name: true } } },
  });
  return rows.map(r => ({ id: r.id, cameraId: r.cameraId, cameraName: r.camera.name, siteId: r.siteId, type: r.type, severity: r.severity, status: r.status.toLowerCase(), occurrenceCount: r.occurrenceCount, detectedAt: r.detectedAt.toISOString(), reviewed: !!r.agentReview }));
}

export const makeSearchViolations = (ctx: ToolContext) => betaZodTool({
  name: 'search_violations',
  description: 'Lọc vi phạm theo camera/công trường/loại/trạng thái/khoảng thời gian. Trả id để đọc tiếp bằng read_violation. Không tìm mờ.',
  inputSchema: searchSchema,
  run: async (input) => safeRun(ctx, 'search_violations', async () => {
    ctx.spent.calls++;
    const rows = await searchViolations(input);
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, type: 'tool.call', data: { tool: 'search_violations', input, count: rows.length } });
    return JSON.stringify(rows);
  }),
});
