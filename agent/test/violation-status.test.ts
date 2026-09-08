// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';

// Bảo vệ bất biến mà src/app/api/violations/[id]/route.ts PATCH dựa vào (dòng
// `data: { status: parsed.data.status.toUpperCase() }`): SQLite phân biệt hoa/thường
// trên cột TEXT, nên mọi truy vấn theo status phải dùng chữ HOA khớp với dữ liệu đã lưu.
// Không import thẳng route handler vì nó cần auth()/assertSiteAccess (ngữ cảnh Next request).

test.before(async () => {
  await prisma.violation.deleteMany({ where: { id: 'v-status-case' } });
  await prisma.organization.upsert({ where: { id: 'org-status' }, update: {}, create: { id: 'org-status', name: 'Status Org' } });
  await prisma.site.upsert({ where: { id: 'site-status' }, update: {}, create: { id: 'site-status', orgId: 'org-status', name: 'Site Status', address: 'x', lat: 0, lng: 0 } });
  await prisma.camera.upsert({ where: { id: 'cam-status' }, update: {}, create: { id: 'cam-status', siteId: 'site-status', name: 'Cam Status', rtspUrl: 'video:samples1.mp4', location: 'gate', status: 'ONLINE' } });
  await prisma.violation.create({ data: { id: 'v-status-case', cameraId: 'cam-status', siteId: 'site-status', type: 'hard_hat', severity: 'medium', confidence: 0.7, bboxData: '[]', snapshotUrl: '/snapshots/x.jpg', status: 'OPEN' } });
});

test('status is stored uppercase and lookups must match case (SQLite is case-sensitive)', async () => {
  await prisma.violation.update({ where: { id: 'v-status-case' }, data: { status: 'resolved'.toUpperCase() } });
  const row = await prisma.violation.findUnique({ where: { id: 'v-status-case' } });
  assert.equal(row?.status, 'RESOLVED');
  const found = await prisma.violation.findMany({ where: { status: 'RESOLVED' } });
  assert.ok(found.some(v => v.id === 'v-status-case'));
  const notFound = await prisma.violation.findMany({ where: { status: 'resolved' } });
  assert.ok(!notFound.some(v => v.id === 'v-status-case'));
});
