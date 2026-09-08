// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';
import { ZaloClient } from '@/lib/zalo';
import { ORG_WIDE_ROLES } from '@/lib/auth/site-access';

const testSchema = z.object({ accessToken: z.string().min(1).optional() });

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ORG_WIDE_ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let accessToken = parsed.data.accessToken;
  if (!accessToken) {
    const settings = await prisma.zaloSettings.findFirst();
    if (!settings?.accessTokenEncrypted) {
      return NextResponse.json({ success: false, error: 'Chưa cấu hình access token' }, { status: 400 });
    }
    accessToken = decrypt(settings.accessTokenEncrypted);
  }

  const result = await new ZaloClient(accessToken).getOa();
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, oaInfo: result.data });
}
