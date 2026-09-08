// SPDX-License-Identifier: MIT

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { allowedSiteIds, requireSession } from '@/lib/auth/site-access';

// Sidebar chỉ cần số badge và id, không cần cả bảng vi phạm (không join camera/site, không parse JSON)
// (Sidebar nằm trên mọi trang dashboard và poll 15s một lần).
export async function GET() {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;

  const allowed = await allowedSiteIds(gate.session);
  // Trả cả danh sách id (chỉ id, không join) để Sidebar trừ những vi phạm người dùng đã "đánh dấu đã đọc"
  // trên trang /alerts (trạng thái đọc nằm ở localStorage phía client, xem src/hooks/use-read-alerts.ts).
  const rows = await prisma.violation.findMany({
    where: { status: 'OPEN', ...(allowed ? { siteId: { in: allowed } } : {}) },
    select: { id: true },
  });
  return NextResponse.json({ open: rows.length, openIds: rows.map(r => r.id) });
}
