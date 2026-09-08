// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ORG_WIDE_ROLES, assertSiteAccess, requireSession } from '@/lib/auth/site-access';
import { logAudit } from '@/lib/audit-log';
import {
  defaultZoneName,
  serializeZonePolygon,
  toZoneDTO,
  zonesPayloadSchema,
} from '@/lib/zone-shape';

/** Camera + kiểm quyền theo công trình. Trả NextResponse khi hỏng để handler return thẳng. */
async function loadCamera(id: string) {
  const camera = await prisma.camera.findUnique({ where: { id } });
  if (!camera) return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
  const authError = await assertSiteAccess(camera.siteId);
  if (authError) return authError;
  return camera;
}

async function listZones(cameraId: string) {
  const rows = await prisma.zone.findMany({
    where: { cameraId, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  // polygonData hỏng (sửa tay trong DB) -> bỏ qua vùng đó thay vì làm hỏng cả trang.
  return rows.map(toZoneDTO).filter((z) => z !== null);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const camera = await loadCamera(id);
  if (camera instanceof NextResponse) return camera;

  return NextResponse.json({ zones: await listZones(id) });
}

// PUT thay TOÀN BỘ danh sách vùng của camera, MỌI loại (gửi zones: [] = xoá hết ->
// AI xét lại cả khung hình và không còn vùng cấm nào). AI engine đọc thẳng bảng
// Zone mỗi 60s nên không cần báo cho tiến trình nào cả.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Sửa vùng = đổi phạm vi AI được phép nhìn -> chỉ quản trị, khớp PAGE_ROLES['/settings']
  // (lối vào duy nhất trên giao diện). GET giữ nguyên để trình sửa vùng đọc được.
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;
  if (!ORG_WIDE_ROLES.includes(gate.session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const camera = await loadCamera(id);
  if (camera instanceof NextResponse) return camera;

  const parsed = zonesPayloadSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.zone.deleteMany({ where: { cameraId: id } }),
    ...parsed.data.zones.map((zone, i) => prisma.zone.create({
      data: {
        siteId: camera.siteId,
        cameraId: id,
        name: zone.name?.trim() || defaultZoneName(i),
        type: zone.type,
        polygonData: serializeZonePolygon(zone.points),
      },
    })),
  ]);

  await logAudit({ session: gate.session, action: 'camera.zones.update', resource: 'camera', resourceId: id, details: `${parsed.data.zones.length} vùng`, request });

  return NextResponse.json({ zones: await listZones(id) });
}
