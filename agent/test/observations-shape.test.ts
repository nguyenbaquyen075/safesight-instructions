// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_OBSERVATIONS_PER_REQUEST, observationsPayloadSchema } from '@/lib/compliance-shape';

// Hợp đồng giữa ai-engine/yolo_inference.py (post_observations) và POST /api/observations.

const row = (over: Record<string, unknown> = {}) => ({
  cameraId: 'cam-001',
  minute: '2026-09-08T03:04:00.000Z',
  persons: 3,
  personSeconds: 150.5,
  ...over,
});

test('a well-formed batch from the engine is accepted', () => {
  assert.equal(observationsPayloadSchema.safeParse({ observations: [row()] }).success, true);
});

test('an empty batch is rejected (the engine must not post nothing)', () => {
  assert.equal(observationsPayloadSchema.safeParse({ observations: [] }).success, false);
});

test('a batch larger than the cap is rejected', () => {
  const many = Array.from({ length: MAX_OBSERVATIONS_PER_REQUEST + 1 }, () => row());
  assert.equal(observationsPayloadSchema.safeParse({ observations: many }).success, false);
});

test('a non-ISO minute is rejected', () => {
  assert.equal(observationsPayloadSchema.safeParse({ observations: [row({ minute: '2026-09-08 03:04' })] }).success, false);
});

test('negative or fractional person counts are rejected', () => {
  assert.equal(observationsPayloadSchema.safeParse({ observations: [row({ persons: -1 })] }).success, false);
  assert.equal(observationsPayloadSchema.safeParse({ observations: [row({ persons: 1.5 })] }).success, false);
  assert.equal(observationsPayloadSchema.safeParse({ observations: [row({ personSeconds: -0.1 })] }).success, false);
});

test('a missing cameraId is rejected', () => {
  assert.equal(observationsPayloadSchema.safeParse({ observations: [row({ cameraId: '' })] }).success, false);
});
