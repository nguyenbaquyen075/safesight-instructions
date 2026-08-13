// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { toCameraDTO, DEMO_CAMERA_IDS } from '@/lib/camera-shape';
import { isValidCameraSource } from '@/lib/camera-source';
import { assertSiteAccess } from '@/lib/auth/site-access';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const camera = await prisma.camera.findUnique({ where: { id }, include: { site: true } });

  if (!camera) {
    return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
  }

  return NextResponse.json(toCameraDTO(camera, camera.site.name));
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  type: z.enum(['fixed', 'ptz', 'dome', 'bullet']).optional(),
  // Nhận chữ thường khớp CameraStatus enum (dropdown ở CameraEditDialog gửi đúng
  // giá trị này) — DB lưu chữ HOA (khớp default trong schema.prisma), chuyển ở dưới.
  status: z.enum(['online', 'offline', 'degraded', 'maintenance']).optional(),
  source: z.string().refine(isValidCameraSource, {
    message: 'source phải là "webcam:<số>" hoặc bắt đầu bằng "rtsp://"',
  }).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const isDemo = DEMO_CAMERA_IDS.has(id);
  const existing = await prisma.camera.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const authError = await assertSiteAccess(existing.siteId);
  if (authError) return authError;

  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { source, status, ...rest } = parsed.data;

  // Camera DEMO dùng video mẫu cố định theo ID (camera-videos.json) — đổi tên/vị trí
  // thoải mái, nhưng KHÔNG cho đổi nguồn video vì AI engine sẽ luôn bỏ qua giá trị
  // này với camera demo (xem yolo_inference.py: load_real_camera_overrides), đổi ở
  // đây sẽ không có tác dụng gì -> chặn sớm để khỏi đánh lừa người dùng.
  if (isDemo && source) {
    return NextResponse.json({ error: 'Camera mẫu (demo) không đổi được nguồn video' }, { status: 400 });
  }

  const camera = await prisma.camera.update({
    where: { id },
    data: { ...rest, ...(source ? { rtspUrl: source } : {}), ...(status ? { status: status.toUpperCase() } : {}) },
    include: { site: true },
  });

  return NextResponse.json(toCameraDTO(camera, camera.site.name));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await prisma.camera.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const authError = await assertSiteAccess(existing.siteId);
  if (authError) return authError;

  // Xoá camera demo -> mất luôn lịch sử Violation demo gắn với nó (Cascade trong
  // schema Prisma) và AI engine sẽ bỏ qua video này ở lần khởi động lại tiếp theo
  // (xem yolo_inference.py: load_video_camera_map lọc theo camera còn tồn tại trong DB).
  await prisma.camera.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
