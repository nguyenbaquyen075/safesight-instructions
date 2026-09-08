// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildViolationWhere, toViolationDTO } from '../../src/lib/violation-shape';
import type { Violation as ViolationRow } from '@prisma/client';

// buildViolationWhere là phần thuần của GET /api/violations (route handler cần
// ngữ cảnh Next request + auth() nên không test trực tiếp được).

test('org-wide roles get no site filter', () => {
  assert.deepEqual(buildViolationWhere({}, null), {});
});

test('status is uppercased to match the value stored in SQLite', () => {
  assert.deepEqual(buildViolationWhere({ status: 'under_review' }, null), { status: 'UNDER_REVIEW' });
});

test('type and severity are passed through in lowercase', () => {
  assert.deepEqual(
    buildViolationWhere({ type: 'hard_hat', severity: 'high' }, null),
    { type: 'hard_hat', severity: 'high' },
  );
});

test('scoped users are limited to their assigned sites', () => {
  assert.deepEqual(
    buildViolationWhere({}, ['site-001', 'site-002']),
    { siteId: { in: ['site-001', 'site-002'] } },
  );
});

test('a requested site inside the scope narrows the filter to that site', () => {
  assert.deepEqual(
    buildViolationWhere({ siteId: 'site-002', status: 'open' }, ['site-001', 'site-002']),
    { siteId: 'site-002', status: 'OPEN' },
  );
});

test('a requested site outside the scope returns null (the caller answers 403)', () => {
  assert.equal(buildViolationWhere({ siteId: 'site-999' }, ['site-001']), null);
});

test('a user with no assigned site matches nothing', () => {
  assert.deepEqual(buildViolationWhere({}, []), { siteId: { in: [] } });
});

test('empty query params are ignored', () => {
  assert.deepEqual(buildViolationWhere({ siteId: null, type: null, severity: null, status: null }, null), {});
});

// Cột clipUrl là NULL với vi phạm không ghi được clip (engine cũ, ring chưa đủ khung):
// DTO phải trả undefined chứ không phải null, vì UI kiểm tra `violation.clipUrl ? ...`.
const row = {
  id: 'v-1', cameraId: 'cam-1', siteId: 'site-1', zoneId: null, type: 'hard_hat', severity: 'critical',
  confidence: 0.9, occurrenceCount: 1, bboxData: '[]', snapshotUrl: '/snapshots/violation_x.jpg',
  status: 'OPEN', agentReview: null, detectedAt: new Date(0), createdAt: new Date(0), updatedAt: new Date(0),
  camera: { name: 'Cam 1' }, site: { name: 'Site 1' },
} as unknown as ViolationRow & { camera: { name: string }; site: { name: string } };

test('the DTO carries the evidence clip url through, and turns a missing clip into undefined', () => {
  assert.equal(toViolationDTO({ ...row, clipUrl: '/snapshots/clip_cam-1_20260908-101500.mp4' }).clipUrl, '/snapshots/clip_cam-1_20260908-101500.mp4');
  assert.equal(toViolationDTO({ ...row, clipUrl: null }).clipUrl, undefined);
});
