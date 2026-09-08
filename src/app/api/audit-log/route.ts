// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ORG_WIDE_ROLES, requireSession } from '@/lib/auth/site-access';
import type { AuditLogEntry } from '@/types/models';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (gate instanceof NextResponse) return gate;
  if (!ORG_WIDE_ROLES.includes(gate.session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const resource = searchParams.get('resource');
  const limitParam = Number(searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : DEFAULT_LIMIT;

  const rows = await prisma.auditLog.findMany({
    where: resource ? { resource } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const entries: AuditLogEntry[] = rows.map(row => ({
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    action: row.action,
    resource: row.resource,
    resourceId: row.resourceId ?? undefined,
    details: row.details ?? undefined,
    ipAddress: row.ipAddress,
    createdAt: row.createdAt.toISOString(),
  }));

  return NextResponse.json(entries);
}
