// SPDX-License-Identifier: MIT
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ORG_WIDE_ROLES, requireSession } from '@/lib/auth/site-access';
import { parseMemory } from '@/lib/camera-agent-shape';

const updateSchema = z.object({
  isEnabled: z.boolean().optional(),
  digestEveryMin: z.number().int().min(5).max(1440).optional(),
  dailyTokenCap: z.number().int().min(0).optional(),
  clearMemory: z.literal(true).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;
  // Như PATCH /api/agent/settings: đổi cấu hình agent là việc toàn tổ chức, không
  // đủ nếu chỉ có quyền trên site của camera. Phòng session cũ còn role chữ HOA.
  if (!ORG_WIDE_ROLES.includes(String(gate.session.user.role).toLowerCase())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const camera = await prisma.camera.findUnique({ where: { id }, select: { id: true } });
  if (!camera) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { clearMemory, ...fields } = parsed.data;
  const data = { ...fields, ...(clearMemory ? { memory: '[]' } : {}) };
  const row = await prisma.cameraAgent.upsert({ where: { id }, create: { id, ...data }, update: data });

  // Mọi thay đổi cài đặt subagent đều để lại dấu vết có userId (spec §8).
  await prisma.agentEvent.create({
    data: {
      sessionId: randomUUID(), subjectType: 'camera', subjectId: id, type: 'action',
      data: JSON.stringify({ action: 'camera-agent.settings', changes: parsed.data, userId: gate.session.user.id }),
    },
  });

  return NextResponse.json({ isEnabled: row.isEnabled, digestEveryMin: row.digestEveryMin, dailyTokenCap: row.dailyTokenCap, memory: parseMemory(row.memory) });
}
