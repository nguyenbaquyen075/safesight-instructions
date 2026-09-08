// SPDX-License-Identifier: MIT
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { allowedSiteIds, requireSession } from '@/lib/auth/site-access';
import { toCameraAgentView } from '@/lib/camera-agent-shape';
import type { CameraAgentView } from '@/types/agent';

export async function GET() {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;

  const siteIds = await allowedSiteIds(gate.session);
  const cameras = await prisma.camera.findMany({
    where: siteIds ? { siteId: { in: siteIds } } : {},
    select: { id: true, name: true, siteId: true, status: true, site: { select: { name: true } } },
    orderBy: [{ siteId: 'asc' }, { name: 'asc' }],
  });
  if (cameras.length === 0) return NextResponse.json([] as CameraAgentView[]);

  const ids = cameras.map(c => c.id);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  // 4 truy vấn gộp thay vì 3 truy vấn/camera: số camera có thể lên hàng chục.
  const [agents, open, last24, reviewed] = await Promise.all([
    prisma.cameraAgent.findMany({ where: { id: { in: ids } } }),
    prisma.violation.groupBy({ by: ['cameraId'], where: { cameraId: { in: ids }, status: 'OPEN' }, _count: { _all: true } }),
    prisma.violation.groupBy({ by: ['cameraId', 'status'], where: { cameraId: { in: ids }, detectedAt: { gt: since } }, _count: { _all: true } }),
    prisma.violation.groupBy({ by: ['cameraId'], where: { cameraId: { in: ids }, detectedAt: { gt: since }, agentReview: { not: null } }, _count: { _all: true } }),
  ]);

  const agentById = new Map(agents.map(a => [a.id, a]));
  const openById = new Map(open.map(r => [r.cameraId, r._count._all]));
  const reviewedById = new Map(reviewed.map(r => [r.cameraId, r._count._all]));
  const total24 = new Map<string, number>();
  const falsePositive24 = new Map<string, number>();
  for (const row of last24) {
    total24.set(row.cameraId, (total24.get(row.cameraId) ?? 0) + row._count._all);
    if (row.status === 'FALSE_POSITIVE') falsePositive24.set(row.cameraId, (falsePositive24.get(row.cameraId) ?? 0) + row._count._all);
  }

  return NextResponse.json(cameras.map(camera => {
    const total = total24.get(camera.id) ?? 0;
    return toCameraAgentView(camera, agentById.get(camera.id) ?? null, {
      openViolations: openById.get(camera.id) ?? 0,
      reviewed24h: reviewedById.get(camera.id) ?? 0,
      // Không có vi phạm nào trong 24h thì tỉ lệ báo oan là 0, không phải NaN.
      falsePositiveRate24h: total === 0 ? 0 : (falsePositive24.get(camera.id) ?? 0) / total,
    });
  }));
}
