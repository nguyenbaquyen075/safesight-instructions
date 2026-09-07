// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { notifyViolation } from '@/lib/alert-notifier';
import { enqueueAgentTask, pokeAgent } from '@/lib/agent-bridge';
import type { Violation } from '@/types/models';

async function getRealViolations(): Promise<Violation[]> {
  const rows = await prisma.violation.findMany({
    include: { camera: true, site: true },
    orderBy: { detectedAt: 'desc' },
  });
  return rows.map((v) => ({
    id: v.id,
    cameraId: v.cameraId,
    cameraName: v.camera.name,
    siteId: v.siteId,
    siteName: v.site.name,
    zoneId: v.zoneId ?? undefined,
    type: v.type as Violation['type'],
    severity: v.severity as Violation['severity'],
    confidence: v.confidence,
    bboxData: JSON.parse(v.bboxData),
    snapshotUrl: v.snapshotUrl,
    clipUrl: v.clipUrl ?? undefined,
    status: v.status.toLowerCase() as Violation['status'],
    agentReview: v.agentReview ? JSON.parse(v.agentReview) : null,
    detectedAt: v.detectedAt.toISOString(),
    createdAt: v.createdAt.toISOString(),
  }));
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get('siteId');
  const type = searchParams.get('type');
  const severity = searchParams.get('severity');
  const status = searchParams.get('status');

  let violations = await getRealViolations();

  if (siteId) {
    violations = violations.filter(v => v.siteId === siteId);
  }
  if (type) {
    violations = violations.filter(v => v.type === type);
  }
  if (severity) {
    violations = violations.filter(v => v.severity === severity);
  }
  if (status) {
    violations = violations.filter(v => v.status === status);
  }
  
  await new Promise((resolve) => setTimeout(resolve, 800));
  return NextResponse.json(violations);
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
