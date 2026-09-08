// SPDX-License-Identifier: MIT
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { parseMemory } from '../lib/camera-agent';
import { safeRun } from '../lib/tool-context';
import type { ToolContext } from '../lib/tool-context';

// Điều phối: phiên toàn hệ thống xem toàn bộ subagent camera (trạng thái, hạn mức, 3 ghi chú mới nhất, vi phạm mở).
export const makeListCameraAgents = (ctx: ToolContext) => betaZodTool({
  name: 'list_camera_agents',
  description: 'Liệt kê subagent của mọi camera: bật/tắt, token hôm nay/trần, digest gần nhất, 3 ghi chú trí nhớ mới nhất, số vi phạm đang mở. Dùng trước khi dispatch_to_camera hoặc khi được hỏi camera nào đang bận/đáng chú ý.',
  inputSchema: z.object({}),
  run: async () => safeRun(ctx, 'list_camera_agents', async () => {
    ctx.spent.calls++;
    const [cameras, agents, open] = await Promise.all([
      prisma.camera.findMany({ select: { id: true, name: true, status: true, siteId: true }, orderBy: { id: 'asc' } }),
      prisma.cameraAgent.findMany(),
      prisma.violation.groupBy({ by: ['cameraId'], where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } /* DB lưu chữ HOA */, _count: { _all: true } }),
    ]);
    const byId = new Map(agents.map(a => [a.id, a]));
    const openBy = new Map(open.map(o => [o.cameraId, o._count._all]));
    return JSON.stringify({
      cameras: cameras.map(c => {
        const a = byId.get(c.id);
        return {
          cameraId: c.id, name: c.name, status: c.status.toLowerCase(), siteId: c.siteId,
          isEnabled: a?.isEnabled ?? true, tokensUsedToday: a?.tokensUsedToday ?? 0, dailyTokenCap: a?.dailyTokenCap ?? 300_000, // mặc định của CameraAgent trong schema
          lastDigestAt: a?.lastDigestAt?.toISOString() ?? null,
          notes: parseMemory(a?.memory ?? '[]').slice(-3).map(n => n.text),
          openViolations: openBy.get(c.id) ?? 0,
        };
      }),
    });
  }),
});
