// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { notifyViolation } from '@/lib/alert-notifier';
import { enqueueAgentTask, pokeAgent } from '@/lib/agent-bridge';
import { buildViolationWhere, toViolationDTO } from '@/lib/violation-shape';
import { allowedSiteIds, requireSession } from '@/lib/auth/site-access';

export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;

  const searchParams = request.nextUrl.searchParams;
  const where = buildViolationWhere(
    {
      siteId: searchParams.get('siteId'),
      type: searchParams.get('type'),
      severity: searchParams.get('severity'),
      status: searchParams.get('status'),
    },
    await allowedSiteIds(gate.session),
  );
  if (!where) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await prisma.violation.findMany({
    where,
    // Chỉ lấy name của camera/site — toViolationDTO không cần cột nào khác.
    include: { camera: { select: { name: true } }, site: { select: { name: true } } },
    orderBy: { detectedAt: 'desc' },
  });
  return NextResponse.json(rows.map(toViolationDTO));
}

const violationInputSchema = z.object({
  cameraId: z.string(),
  type: z.string(),
  severity: z.string(),
  confidence: z.number().min(0).max(1),
  bboxData: z.array(
    z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      label: z.string(),
      confidence: z.number(),
    })
  ),
  snapshotUrl: z.string(),
  zoneId: z.string().optional(),
  occurrenceCount: z.number().int().min(1).optional(),
});

// Ghi vi phạm thật từ AI inference (yolo_inference.py) vào DB.
// cameraId phải tồn tại sẵn (seed qua `npm run db:seed`) — siteId suy ra từ Camera,
// không nhận trực tiếp từ caller để tránh lệch dữ liệu giữa 2 nơi.
//
// Bắt buộc header X-AI-Engine-Secret khớp AI_ENGINE_SECRET — chặn ghi trái phép
// từ nguồn khác (repo đã public). Cố ý "fail closed": nếu server chưa cấu hình
// AI_ENGINE_SECRET thì mọi request đều bị từ chối thay vì âm thầm mở toang.
export async function POST(request: NextRequest) {
  const secret = process.env.AI_ENGINE_SECRET;
  if (!secret || request.headers.get('x-ai-engine-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = violationInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { cameraId, type, severity, confidence, bboxData, snapshotUrl, zoneId, occurrenceCount } = parsed.data;

  const camera = await prisma.camera.findUnique({ where: { id: cameraId } });
  if (!camera) {
    return NextResponse.json({ error: `Camera ${cameraId} not found` }, { status: 404 });
  }

  const violation = await prisma.violation.create({
    data: {
      cameraId,
      siteId: camera.siteId,
      zoneId,
      type,
      severity,
      confidence,
      bboxData: JSON.stringify(bboxData),
      snapshotUrl,
      ...(occurrenceCount !== undefined && { occurrenceCount }),
    },
  });

  // ponytail: fire-and-forget vì server chạy long-lived process (dev-all.sh),
  // KHÔNG await — yolo_inference.py đang chặn frame loop chờ response này.
  // Nếu chuyển sang serverless (Vercel functions) phải đổi sang waitUntil/queue.
  notifyViolation(violation, camera).catch((err) => console.error('[telegram] notify failed', err));

  // Agent review vi phạm này (lane nghiên cứu). Row là thông điệp; poke chỉ đánh thức sớm.
  enqueueAgentTask({ kind: 'violation.review', subjectType: 'violation', subjectId: violation.id, reason: `Vi phạm mới ${type} tại ${camera.name} (lần ${occurrenceCount ?? 1})`, priority: 300 })
    .then(() => pokeAgent('/internal/dispatch'))
    .catch((err) => console.error('[agent] enqueue failed', err));

  return NextResponse.json(violation, { status: 201 });
}
