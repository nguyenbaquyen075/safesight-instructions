// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import type { AlertRule as AlertRuleRow } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { alertRuleSchema } from '@/lib/validation/alert-rule';

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
  const rules = await prisma.alertRule.findMany({
    where: siteId ? { siteId } : undefined,
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
