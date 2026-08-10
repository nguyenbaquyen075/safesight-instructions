// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/crypto';
import { ORG_WIDE_ROLES } from '@/lib/auth/site-access';

async function getOrCreateSettings() {
  const existing = await prisma.telegramSettings.findFirst();
  if (existing) return existing;
  return prisma.telegramSettings.create({ data: {} });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ORG_WIDE_ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const settings = await getOrCreateSettings();
  return NextResponse.json({
    isEnabled: settings.isEnabled,
    hasToken: !!settings.botTokenEncrypted,
  });
}

const updateSchema = z.object({
  botToken: z.string().min(1).optional(),
  isEnabled: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ORG_WIDE_ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await getOrCreateSettings();
  const data: { botTokenEncrypted?: string; isEnabled?: boolean } = {};
  if (parsed.data.botToken) data.botTokenEncrypted = encrypt(parsed.data.botToken);
  if (parsed.data.isEnabled !== undefined) data.isEnabled = parsed.data.isEnabled;

  const updated = await prisma.telegramSettings.update({ where: { id: settings.id }, data });
  return NextResponse.json({ isEnabled: updated.isEnabled, hasToken: !!updated.botTokenEncrypted });
}
