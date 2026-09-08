// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { toCameraDTO, DEMO_CAMERA_IDS } from '@/lib/camera-shape';
import { isValidCameraSource } from '@/lib/camera-source';
import { allowedSiteIds, assertSiteAccess, requireSession } from '@/lib/auth/site-access';

export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;

  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get('siteId');
  const status = searchParams.get('status');
  const includeDemo = searchParams.get('includeDemo') === 'true';

  // null = vai trò toàn tổ chức; ngược lại chỉ thấy camera thuộc site được giao.
  const allowed = await allowedSiteIds(gate.session);
  if (siteId && allowed && !allowed.includes(siteId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await prisma.camera.findMany({
    where: {
      ...(includeDemo ? {} : { id: { notIn: Array.from(DEMO_CAMERA_IDS) } }),
      ...(siteId ? { siteId } : allowed ? { siteId: { in: allowed } } : {}),
      ...(status ? { status: status.toUpperCase() } : {}), // DB lưu chữ HOA, xem toCameraDTO
    },
    include: { site: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(rows.map(c => toCameraDTO(c, c.site.name)));
}

const createSchema = z.object({
  name: z.string().min(1),
  siteId: z.string().min(1),
  location: z.string().min(1),
  type: z.enum(['fixed', 'ptz', 'dome', 'bullet']).default('fixed'),
  source: z.string().refine(isValidCameraSource, {
    message: 'source phải là "webcam:<số>" hoặc bắt đầu bằng "rtsp://"',
  }),
});

export async function POST(request: NextRequest) {
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const authError = await assertSiteAccess(parsed.data.siteId);
  if (authError) return authError;

  const site = await prisma.site.findUnique({ where: { id: parsed.data.siteId } });
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const camera = await prisma.camera.create({
    data: {
      siteId: parsed.data.siteId,
      name: parsed.data.name,
      location: parsed.data.location,
      type: parsed.data.type,
      rtspUrl: parsed.data.source,
      // ONLINE = AI engine sẽ dùng camera này ở lần khởi động lại tiếp theo.
      // Đổi sang OFFLINE/MAINTENANCE (sửa camera) để "đóng" — AI ngừng phân tích.
      // Lưu chữ HOA khớp default trong schema.prisma; đọc ra qua toCameraDTO()
      // sẽ tự chuyển lại chữ thường khớp CameraStatus enum ở frontend.
      status: 'ONLINE',
    },
  });

  return NextResponse.json(toCameraDTO(camera, site.name), { status: 201 });
}
