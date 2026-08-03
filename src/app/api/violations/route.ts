// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { mockViolations } from '@/data/mock-violations';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get('siteId');
  const type = searchParams.get('type');
  const severity = searchParams.get('severity');
  const status = searchParams.get('status');
  
  let violations = [...mockViolations];
  
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
});

// Ghi vi phạm thật từ AI inference (yolo_inference.py) vào DB.
// cameraId phải tồn tại sẵn (seed qua `npm run db:seed`) — siteId suy ra từ Camera,
// không nhận trực tiếp từ caller để tránh lệch dữ liệu giữa 2 nơi.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = violationInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { cameraId, type, severity, confidence, bboxData, snapshotUrl, zoneId } = parsed.data;

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
    },
  });

  return NextResponse.json(violation, { status: 201 });
}
