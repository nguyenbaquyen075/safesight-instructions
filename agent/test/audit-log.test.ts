// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Session } from 'next-auth';
import { prisma } from '../lib/db';
import { logAudit } from '@/lib/audit-log';
import { UserRole } from '@/types/enums';

const session: Session = {
  user: { id: 'user-audit-t', name: 'Audit Tester', email: 'audit-t@safesight.ai', role: UserRole.ORG_ADMIN },
  expires: new Date(Date.now() + 3600_000).toISOString(),
};

test.beforeEach(async () => {
  await prisma.auditLog.deleteMany({ where: { userId: 'user-audit-t' } });
});

test('logAudit writes a row with the right fields, defaulting ipAddress to "local" without a request', async () => {
  await logAudit({ session, action: 'user.create', resource: 'user', resourceId: 'user-002', details: 'someone@safesight.ai' });

  const rows = await prisma.auditLog.findMany({ where: { userId: 'user-audit-t' } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].userName, 'Audit Tester');
  assert.equal(rows[0].action, 'user.create');
  assert.equal(rows[0].resource, 'user');
  assert.equal(rows[0].resourceId, 'user-002');
  assert.equal(rows[0].details, 'someone@safesight.ai');
  assert.equal(rows[0].ipAddress, 'local');
});

test('logAudit reads the client IP from x-forwarded-for, taking the first hop', async () => {
  const headers = new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' });
  await logAudit({ session, action: 'camera.update', resource: 'camera', request: { headers } });

  const rows = await prisma.auditLog.findMany({ where: { userId: 'user-audit-t' } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ipAddress, '203.0.113.5');
  assert.equal(rows[0].resourceId, null);
});

test('logAudit swallows DB errors instead of throwing', async () => {
  // userId is a required (NOT NULL) column — a null id forces a real Prisma
  // failure so this test proves the try/catch, not just that valid input works.
  const invalidSession = {
    user: { id: null, name: 'Audit Tester', email: 'audit-t@safesight.ai', role: UserRole.ORG_ADMIN },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  } as unknown as Session;

  await assert.doesNotReject(() => logAudit({ session: invalidSession, action: 'user.create', resource: 'user' }));
});
