// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { createUserSchema } from '../../src/lib/user-shape';

// createUserSchema là phần thuần của POST /api/users (route cần Next request +
// Prisma nên không test trực tiếp được ở đây).

test('accepts a well-formed payload and defaults assignedSites to []', () => {
  const parsed = createUserSchema.parse({
    name: 'Nguyễn Văn A',
    email: 'a@safesight.ai',
    password: 'matkhaudai',
    role: 'safety_officer',
  });
  assert.deepEqual(parsed, {
    name: 'Nguyễn Văn A',
    email: 'a@safesight.ai',
    password: 'matkhaudai',
    role: 'safety_officer',
    assignedSites: [],
  });
});

test('rejects a password shorter than 8 characters', () => {
  const result = createUserSchema.safeParse({
    name: 'A', email: 'a@safesight.ai', password: 'short', role: 'supervisor',
  });
  assert.equal(result.success, false);
});

test('rejects an invalid email', () => {
  const result = createUserSchema.safeParse({
    name: 'A', email: 'not-an-email', password: 'matkhaudai', role: 'supervisor',
  });
  assert.equal(result.success, false);
});

test('rejects a role outside UserRole', () => {
  const result = createUserSchema.safeParse({
    name: 'A', email: 'a@safesight.ai', password: 'matkhaudai', role: 'root',
  });
  assert.equal(result.success, false);
});

test('passes through an explicit assignedSites list', () => {
  const parsed = createUserSchema.parse({
    name: 'A', email: 'a@safesight.ai', password: 'matkhaudai', role: 'site_manager', assignedSites: ['site-001', 'site-002'],
  });
  assert.deepEqual(parsed.assignedSites, ['site-001', 'site-002']);
});
