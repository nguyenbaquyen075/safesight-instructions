// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';
import { TelegramClient } from '@/lib/telegram';
import { ORG_WIDE_ROLES } from '@/lib/auth/site-access';

const testSchema = z.object({ botToken: z.string().min(1).optional() });

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ORG_WIDE_ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let botToken = parsed.data.botToken;
  if (!botToken) {
    const settings = await prisma.telegramSettings.findFirst();
    if (!settings?.botTokenEncrypted) {
      return NextResponse.json({ success: false, error: 'Chưa cấu hình token' }, { status: 400 });
    }
    botToken = decrypt(settings.botTokenEncrypted);
  }

  const result = await new TelegramClient(botToken).getMe();
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.description }, { status: 400 });
  }
  return NextResponse.json({ success: true, botInfo: result.result });
}
