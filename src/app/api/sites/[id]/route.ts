// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toSiteDTO } from '@/lib/site-shape';
import { assertSiteAccess } from '@/lib/auth/site-access';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Kiểm tra trước khi đọc DB: id chính là site cần kiểm tra quyền (401/403 trước 404).
  const authError = await assertSiteAccess(id);
  if (authError) return authError;

  const site = await prisma.site.findUnique({ where: { id } });

  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  return NextResponse.json(toSiteDTO(site));
}
