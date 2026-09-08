// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { bboxCenters, hourWeekdayGrid, maxCell } from '@/lib/heatmap-shape';

// Phần thuần cho /analytics (F7): gộp vi phạm theo giờ×thứ và quy đổi bboxData -> tâm
// điểm để vẽ heatmap. Không cần route/DB — chỉ dữ liệu tối thiểu các hàm đọc tới.

test('hourWeekdayGrid counts each violation into its weekday row and hour column', () => {
  const grid = hourWeekdayGrid([
    { detectedAt: '2026-09-08T03:15:00.000Z' }, // Tuesday 2026-09-08 -> local hour depends on TZ, so pin via Date
    { detectedAt: '2026-09-08T03:45:00.000Z' }, // same weekday+hour as above -> same cell
  ]);
  const d = new Date('2026-09-08T03:15:00.000Z');
  assert.equal(grid[d.getDay()][d.getHours()], 2);
  assert.equal(grid.length, 7);
  assert.equal(grid[0].length, 24);
});

test('hourWeekdayGrid returns an all-zero 7x24 grid for no rows', () => {
  const grid = hourWeekdayGrid([]);
  assert.equal(grid.length, 7);
  assert.ok(grid.every((row) => row.length === 24 && row.every((v) => v === 0)));
});

test('hourWeekdayGrid skips a row with an unparseable date instead of throwing', () => {
  assert.doesNotThrow(() => hourWeekdayGrid([{ detectedAt: 'not-a-date' }]));
  const grid = hourWeekdayGrid([{ detectedAt: 'not-a-date' }]);
  assert.ok(grid.flat().every((v) => v === 0));
});

test('bboxCenters computes the center of each box as a 0-1 ratio', () => {
  const centers = bboxCenters([
    { type: 'hard_hat', bboxData: [{ x: 0.2, y: 0.3, width: 0.1, height: 0.2, label: 'person', confidence: 0.9 }] },
  ]);
  assert.deepEqual(centers, [{ x: 0.25, y: 0.4, type: 'hard_hat' }]);
});

test('bboxCenters flattens multiple boxes across multiple violations', () => {
  const centers = bboxCenters([
    { type: 'hard_hat', bboxData: [{ x: 0, y: 0, width: 0.2, height: 0.2, label: 'a', confidence: 1 }] },
    {
      type: 'safety_vest',
      bboxData: [
        { x: 0.5, y: 0.5, width: 0.2, height: 0.2, label: 'a', confidence: 1 },
        { x: 0.1, y: 0.1, width: 0.1, height: 0.1, label: 'b', confidence: 1 },
      ],
    },
  ]);
  assert.equal(centers.length, 3);
  assert.deepEqual(centers[1], { x: 0.6, y: 0.6, type: 'safety_vest' });
});

test('bboxCenters skips a violation with a missing or malformed bboxData instead of throwing', () => {
  assert.doesNotThrow(() => bboxCenters([
    // @ts-expect-error -- simulating corrupt data from a broken JSON column
    { type: 'hard_hat', bboxData: null },
    // @ts-expect-error -- missing width/height -> NaN center, must be skipped not thrown
    { type: 'hard_hat', bboxData: [{ x: 0.1, y: 0.1 }] },
    { type: 'hard_hat', bboxData: [{ x: 0.1, y: 0.1, width: 0.1, height: 0.1, label: 'ok', confidence: 1 }] },
  ]));
  const centers = bboxCenters([
    // @ts-expect-error -- simulating corrupt data from a broken JSON column
    { type: 'hard_hat', bboxData: null },
    // @ts-expect-error -- missing width/height -> NaN center, must be skipped not thrown
    { type: 'hard_hat', bboxData: [{ x: 0.1, y: 0.1 }] },
    { type: 'hard_hat', bboxData: [{ x: 0.1, y: 0.1, width: 0.1, height: 0.1, label: 'ok', confidence: 1 }] },
  ]);
  assert.equal(centers.length, 1);
  assert.equal(centers[0].type, 'hard_hat');
  assert.ok(Math.abs(centers[0].x - 0.15) < 1e-9);
  assert.ok(Math.abs(centers[0].y - 0.15) < 1e-9);
});

test('maxCell finds the largest count in the grid', () => {
  const grid = hourWeekdayGrid([
    { detectedAt: '2026-09-08T03:00:00.000Z' },
    { detectedAt: '2026-09-08T03:10:00.000Z' },
    { detectedAt: '2026-09-08T04:00:00.000Z' },
  ]);
  assert.equal(maxCell(grid), 2);
});

test('maxCell returns 0 for an all-zero grid', () => {
  assert.equal(maxCell(hourWeekdayGrid([])), 0);
});
