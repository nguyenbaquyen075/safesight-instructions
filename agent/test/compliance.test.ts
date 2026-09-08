// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { complianceByDay } from '@/lib/compliance-shape';

// Phần thuần của GET /api/stats/compliance (route handler cần auth() nên không test
// trực tiếp được, giống zones-shape.test.ts).

const minutes = (day: string, count: number, personSeconds: number) =>
  Array.from({ length: count }, (_, i) => ({
    minute: new Date(Date.parse(`${day}T00:00:00.000Z`) + i * 60_000).toISOString(),
    personSeconds,
  }));

test('a day with observations and violations yields the observed rate', () => {
  // 100 phút, mỗi phút 60 người-giây = 100 phút-người; 5 vi phạm -> 0.95
  const days = complianceByDay(minutes('2026-09-01', 100, 60), [
    ...Array.from({ length: 5 }, () => ({ detectedAt: '2026-09-01T09:00:00.000Z' })),
  ], '2026-09-01', '2026-09-01');
  assert.deepEqual(days, [{ day: '2026-09-01', personMinutes: 100, violations: 5, complianceRate: 0.95 }]);
});

test('a day without observations reports null instead of a fake 100%', () => {
  const days = complianceByDay([], [{ detectedAt: '2026-09-01T09:00:00.000Z' }], '2026-09-01', '2026-09-01');
  assert.equal(days[0].complianceRate, null);
  assert.equal(days[0].violations, 1);
  assert.equal(days[0].personMinutes, 0);
});

test('more violations than person-minutes clamps the rate to 0', () => {
  const days = complianceByDay(minutes('2026-09-01', 1, 60), [
    ...Array.from({ length: 9 }, () => ({ detectedAt: '2026-09-01T09:00:00.000Z' })),
  ], '2026-09-01', '2026-09-01');
  assert.equal(days[0].complianceRate, 0);
});

test('every day in the range appears, in order, even when empty', () => {
  const days = complianceByDay(minutes('2026-09-03', 60, 60), [], '2026-09-01', '2026-09-03');
  assert.deepEqual(days.map(d => d.day), ['2026-09-01', '2026-09-02', '2026-09-03']);
  assert.deepEqual(days.map(d => d.complianceRate), [null, null, 1]);
});

test('person-seconds are summed across the minutes of a day', () => {
  const days = complianceByDay(
    [...minutes('2026-09-01', 2, 120), ...minutes('2026-09-02', 1, 60)],
    [],
    '2026-09-01',
    '2026-09-02',
  );
  assert.deepEqual(days.map(d => d.personMinutes), [4, 1]);
});

test('rows and violations outside the range are ignored', () => {
  const days = complianceByDay(minutes('2026-08-30', 60, 60), [{ detectedAt: '2026-08-30T09:00:00.000Z' }], '2026-09-01', '2026-09-01');
  assert.deepEqual(days, [{ day: '2026-09-01', personMinutes: 0, violations: 0, complianceRate: null }]);
});
