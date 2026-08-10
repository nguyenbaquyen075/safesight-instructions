// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import type { AlertRule as AlertRuleRow } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { alertRuleSchema } from '@/lib/validation/alert-rule';
import { assertSiteAccess, ORG_WIDE_ROLES } from '@/lib/auth/site-access';

function serializeRule(rule: AlertRuleRow) {
  return {
    ...rule,
    violationTypes: JSON.parse(rule.violationTypes),
    channels: JSON.parse(rule.channels),
    recipients: JSON.parse(rule.recipients),
  };
}

export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('siteId');

  if (siteId) {
    const authError = await assertSiteAccess(siteId);
    if (authError) return authError;

    const rules = await prisma.alertRule.findMany({
      where: { siteId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(rules.map(serializeRule));
  }

  // No siteId filter: still require a session; scope to the caller's assigned
  // sites unless they hold an org-wide role.
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let where: { siteId?: { in: string[] } } | undefined;
  if (!ORG_WIDE_ROLES.includes(session.user.role)) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    const assignedSites: string[] = user ? JSON.parse(user.assignedSites) : [];
    where = { siteId: { in: assignedSites } };
  }

  const rules = await prisma.alertRule.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(rules.map(serializeRule));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = alertRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const authError = await assertSiteAccess(parsed.data.siteId);
  if (authError) return authError;

  const { violationTypes, channels, recipients, ...rest } = parsed.data;
  const rule = await prisma.alertRule.create({
    data: {
      ...rest,
      violationTypes: JSON.stringify(violationTypes),
      channels: JSON.stringify(channels),
      recipients: JSON.stringify(recipients),
    },
  });
  return NextResponse.json(serializeRule(rule), { status: 201 });
}
