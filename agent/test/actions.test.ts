// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickCleanup } from '../direct/cleanup';
import { escapeHtml } from '../lib/notify';

const DAY = 86_400_000;
const now = Date.parse('2026-09-07T10:00:00Z');

test('pickCleanup deletes oldest files first, skips files under 24h or files with no referencing Violation', () => {
  const files = [
    { name: 'violation_b.jpg', mtimeMs: now - 35 * DAY, referenced: true },
    { name: 'violation_a.jpg', mtimeMs: now - 40 * DAY, referenced: true },
    { name: 'violation_c.jpg', mtimeMs: now - 2 * DAY, referenced: true },
    { name: 'violation_d.jpg', mtimeMs: now - 50 * DAY, referenced: false },
    { name: 'violation_e.jpg', mtimeMs: now - 1000, referenced: true },
  ];
  const sizes = { 'violation_a.jpg': 100, 'violation_b.jpg': 100, 'violation_c.jpg': 100, 'violation_d.jpg': 100, 'violation_e.jpg': 100 };
  assert.deepEqual(pickCleanup(files, now, 150, sizes), ['violation_a.jpg', 'violation_b.jpg']);
  assert.deepEqual(pickCleanup(files, now, 1000, sizes), ['violation_a.jpg', 'violation_b.jpg'], 'chỉ xoá file > 30 ngày có tham chiếu');
});

test('escapeHtml blocks HTML tags in model-generated text', () => {
  assert.equal(escapeHtml('cam <b>1</b> & 2'), 'cam &lt;b&gt;1&lt;/b&gt; &amp; 2');
  assert.equal(escapeHtml('không có gì đặc biệt'), 'không có gì đặc biệt');
});
