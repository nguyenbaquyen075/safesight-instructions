// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import type { AlertRule as AlertRuleRow } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { alertRuleObjectSchema, alertRuleSchema } from '@/lib/validation/alert-rule';
import { UserRole } from '@/types/enums';

const ORG_WIDE_ROLES: string[] = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN];

function serializeRule(rule: AlertRuleRow) {
  return {
    ...rule,
    violationTypes: JSON.parse(rule.violationTypes),
    channels: JSON.parse(rule.channels),
    recipients: JSON.parse(rule.recipients),
  };
}

async function assertSiteAccess(siteId: string): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ORG_WIDE_ROLES.includes(session.user.role)) return null;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const assignedSites: string[] = user ? JSON.parse(user.assignedSites) : [];
  if (!assignedSites.includes(siteId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.alertRule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const authError = await assertSiteAccess(existing.siteId);
  if (authError) return authError;

  const body = await request.json();
  const parsedPatch = alertRuleObjectSchema.partial().safeParse(body);
  if (!parsedPatch.success) {
    return NextResponse.json({ error: parsedPatch.error.flatten() }, { status: 400 });
  }

  const merged = {
    siteId: existing.siteId,
    name: existing.name,
    violationTypes: JSON.parse(existing.violationTypes),
    channels: JSON.parse(existing.channels),
    recipients: JSON.parse(existing.recipients),
    threshold: existing.threshold,
    cooldownSec: existing.cooldownSec,
    isActive: existing.isActive,
    ...parsedPatch.data,
  };
  const parsedMerged = alertRuleSchema.safeParse(merged);
  if (!parsedMerged.success) {
    return NextResponse.json({ error: parsedMerged.error.flatten() }, { status: 400 });
  }

  const { violationTypes, channels, recipients, ...rest } = parsedMerged.data;
  const updated = await prisma.alertRule.update({
    where: { id },
    data: {
      ...rest,
      violationTypes: JSON.stringify(violationTypes),
      channels: JSON.stringify(channels),
      recipients: JSON.stringify(recipients),
    },
  });
  return NextResponse.json(serializeRule(updated));
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.alertRule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const authError = await assertSiteAccess(existing.siteId);
  if (authError) return authError;

  await prisma.alertRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
