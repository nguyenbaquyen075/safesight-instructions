// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { observationsPayloadSchema } from '@/lib/compliance-shape';

// Nhận số người AI quan sát được mỗi phút từ ai-engine/yolo_inference.py.
// Giống POST /api/violations: bắt buộc header X-AI-Engine-Secret khớp AI_ENGINE_SECRET
// và "fail closed" khi server chưa cấu hình secret. siteId suy ra từ Camera, không nhận
// từ caller. Upsert theo (cameraId, minute) -> engine gửi lại cùng một phút (khởi động
// lại, mạng chập chờn) cũng không nhân đôi mẫu số.
export async function POST(request: NextRequest) {
  const secret = process.env.AI_ENGINE_SECRET;
  if (!secret || request.headers.get('x-ai-engine-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = observationsPayloadSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const rows = parsed.data.observations;

  // Camera vừa bị xoá trên web nhưng engine chưa kịp nạp lại -> bỏ qua dòng đó thay vì
  // trả lỗi cho cả lô (engine không có cách nào xử lý lỗi ngoài log).
  const cameras = await prisma.camera.findMany({
    where: { id: { in: Array.from(new Set(rows.map(r => r.cameraId))) } },
    select: { id: true, siteId: true },
  });
  const siteByCamera = new Map(cameras.map(c => [c.id, c.siteId]));

  // Một $transaction cho cả lô: trên SQLite mỗi upsert rời là một giao dịch ghi
  // riêng, tranh file với API, agent và engine (xem src/lib/prisma.ts).
  const writes = rows.flatMap(row => {
    const siteId = siteByCamera.get(row.cameraId);
    if (!siteId) return [];
    const minute = new Date(row.minute);
    const data = { persons: row.persons, personSeconds: Math.round(row.personSeconds) };
    return [prisma.observationStat.upsert({
      where: { cameraId_minute: { cameraId: row.cameraId, minute } },
      update: data,
      create: { cameraId: row.cameraId, siteId, minute, ...data },
    })];
  });
  if (writes.length) await prisma.$transaction(writes);

  return NextResponse.json({ upserted: writes.length }, { status: 201 });
}
