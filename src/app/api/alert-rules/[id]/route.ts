// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import type { AlertRule as AlertRuleRow } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { alertRuleObjectSchema, alertRuleSchema } from '@/lib/validation/alert-rule';
import { assertSiteAccess } from '@/lib/auth/site-access';

function serializeRule(rule: AlertRuleRow) {
  return {
    ...rule,
    violationTypes: JSON.parse(rule.violationTypes),
    channels: JSON.parse(rule.channels),
    recipients: JSON.parse(rule.recipients),
  };
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
    name: existing.name,
    violationTypes: JSON.parse(existing.violationTypes),
    channels: JSON.parse(existing.channels),
    recipients: JSON.parse(existing.recipients),
    threshold: existing.threshold,
    cooldownSec: existing.cooldownSec,
    isActive: existing.isActive,
    ...parsedPatch.data,
    // siteId is locked to the existing row and always wins, regardless of
    // what the request body contains: this endpoint does not support moving
    // a rule between sites (that would need a fresh assertSiteAccess check
    // against the new site, which we deliberately don't do here).
    siteId: existing.siteId,
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
