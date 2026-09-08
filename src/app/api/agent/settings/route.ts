// SPDX-License-Identifier: MIT
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ORG_WIDE_ROLES } from '@/lib/auth/site-access';
import type { AgentSettingsView } from '@/types/agent';

// id cố định 'agent-settings', khớp AGENT_SETTINGS_ID trong agent/lib/settings.ts (một dòng duy nhất, dùng chung giữa web và worker).
async function getOrCreate() {
  return prisma.agentSettings.upsert({ where: { id: 'agent-settings' }, update: {}, create: { id: 'agent-settings' } });
}
const toView = (s: Awaited<ReturnType<typeof getOrCreate>>): AgentSettingsView => ({ isEnabled: s.isEnabled, model: s.model, reviewEffort: s.reviewEffort, dailyTokenCap: s.dailyTokenCap, shiftReportAt: s.shiftReportAt });

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // GET cho mọi người đã đăng nhập (không có secret); chỉ PATCH giới hạn quản trị.
  return NextResponse.json(toView(await getOrCreate()));
}

const updateSchema = z.object({
  isEnabled: z.boolean().optional(),
  model: z.string().min(1).max(100).optional(), // tên model do proxy quyết định, không khoá vào danh sách Anthropic
  reviewEffort: z.enum(['low', 'medium', 'high']).optional(),
  dailyTokenCap: z.number().int().min(100_000).max(50_000_000).optional(),
  shiftReportAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ORG_WIDE_ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const current = await getOrCreate();
  const updated = await prisma.agentSettings.update({ where: { id: current.id }, data: parsed.data });
  return NextResponse.json(toView(updated));
}
