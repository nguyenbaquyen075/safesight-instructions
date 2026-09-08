// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildViolationWhere } from '../../src/lib/violation-shape';

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
