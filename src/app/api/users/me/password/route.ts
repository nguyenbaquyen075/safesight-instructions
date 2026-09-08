// SPDX-License-Identifier: MIT

import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth/site-access';
import { logAudit } from '@/lib/audit-log';

const BCRYPT_ROUNDS = 10;

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function PATCH(request: NextRequest) {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;

  const parsed = changePasswordSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: gate.session.user.id } });
  // Tài khoản dev cứng (src/auth.ts, không có dòng User) không thể đổi mật khẩu.
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: 'Tài khoản này không đổi được mật khẩu' }, { status: 400 });
  }

  const match = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!match) {
    return NextResponse.json({ error: 'Mật khẩu hiện tại không đúng' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  await logAudit({ session: gate.session, action: 'user.change-password', resource: 'user', resourceId: user.id, request });

  return NextResponse.json({ success: true });
}
