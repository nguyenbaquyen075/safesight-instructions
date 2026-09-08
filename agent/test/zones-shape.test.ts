// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultZoneName, parseZonePolygon, serializeZonePolygon, toZoneDTO, zonesPayloadSchema } from '@/lib/zone-shape';

// Phần thuần của GET/PUT /api/cameras/[id]/zones (route handler cần ngữ cảnh Next
// request + auth() nên không test trực tiếp được, giống camera-agent-shape.test.ts).

const TRIANGLE = [{ x: 0.1, y: 0.2 }, { x: 0.9, y: 0.2 }, { x: 0.5, y: 0.9 }];

test('a valid polygon round-trips through serialize and parse', () => {
  const raw = serializeZonePolygon(TRIANGLE);
  assert.deepEqual(parseZonePolygon(raw), TRIANGLE);
});

test('serialize rounds coordinates to 4 decimals', () => {
  const raw = serializeZonePolygon([{ x: 0.123456789, y: 0.5 }, { x: 0.9, y: 0.2 }, { x: 0.5, y: 0.9 }]);
  assert.equal(JSON.parse(raw)[0].x, 0.1235);
});

test('broken JSON parses to null instead of throwing', () => {
  assert.equal(parseZonePolygon('{not json'), null);
});

test('a polygon with fewer than 3 points is rejected', () => {
  assert.equal(parseZonePolygon(JSON.stringify(TRIANGLE.slice(0, 2))), null);
});

test('a coordinate outside 0-1 is rejected', () => {
  assert.equal(parseZonePolygon(JSON.stringify([{ x: 1.5, y: 0.2 }, ...TRIANGLE.slice(1)])), null);
});

test('a zone row with a broken polygon has no DTO', () => {
  assert.equal(toZoneDTO({ id: 'z1', name: 'Vùng 1', polygonData: '[]' }), null);
  assert.deepEqual(toZoneDTO({ id: 'z1', name: 'Vùng 1', polygonData: serializeZonePolygon(TRIANGLE) }), {
    id: 'z1', name: 'Vùng 1', points: TRIANGLE,
  });
});

test('the PUT payload accepts an empty list (clearing every zone)', () => {
  assert.equal(zonesPayloadSchema.safeParse({ zones: [] }).success, true);
});

test('the PUT payload rejects a polygon with too few points and one with too many', () => {
  assert.equal(zonesPayloadSchema.safeParse({ zones: [{ points: TRIANGLE.slice(0, 2) }] }).success, false);
  const many = Array.from({ length: 21 }, (_, i) => ({ x: i / 100, y: 0.5 }));
  assert.equal(zonesPayloadSchema.safeParse({ zones: [{ points: many }] }).success, false);
});

test('an unnamed zone falls back to a numbered Vietnamese name', () => {
  assert.equal(defaultZoneName(0), 'Vùng 1');
  assert.equal(defaultZoneName(2), 'Vùng 3');
});
