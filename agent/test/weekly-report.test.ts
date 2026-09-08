// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { ensureRecurring, nextWeekly } from '../lib/recurring';
import { PRIORITY, RESEARCH_KINDS } from '../lib/tasks';
import { AGENT_SETTINGS_ID, getAgentSettings } from '../lib/settings';

test.beforeEach(async () => { await prisma.agentTask.deleteMany(); });

test('weekly.report is a research kind with a priority below the shift report', () => {
  assert.ok((RESEARCH_KINDS as readonly string[]).includes('weekly.report'));
  assert.equal(PRIORITY['weekly.report'], 150);
  assert.ok(PRIORITY['weekly.report'] < PRIORITY['shift.report']);
});

test('nextWeekly returns the next matching weekday at the configured time', () => {
  // 2026-09-08 là thứ Ba (getDay() === 2).
  const tuesday = new Date(2026, 8, 8, 9, 0, 0, 0);
  assert.equal(nextWeekly('MON 08:00', tuesday).getTime(), new Date(2026, 8, 14, 8, 0, 0, 0).getTime());
  assert.equal(nextWeekly('FRI 17:30', tuesday).getTime(), new Date(2026, 8, 11, 17, 30, 0, 0).getTime());
  assert.equal(nextWeekly('SUN 06:05', tuesday).getTime(), new Date(2026, 8, 13, 6, 5, 0, 0).getTime());
});

test('nextWeekly skips to next week when the slot today already passed, and keeps a later slot today', () => {
  const tuesday = new Date(2026, 8, 8, 9, 0, 0, 0);
  assert.equal(nextWeekly('TUE 08:00', tuesday).getTime(), new Date(2026, 8, 15, 8, 0, 0, 0).getTime());
  assert.equal(nextWeekly('TUE 09:00', tuesday).getTime(), new Date(2026, 8, 15, 9, 0, 0, 0).getTime(), 'đúng bằng now thì lùi sang tuần sau');
  assert.equal(nextWeekly('TUE 21:00', tuesday).getTime(), new Date(2026, 8, 8, 21, 0, 0, 0).getTime());
});

test('nextWeekly falls back to MON 08:00 for a malformed spec', () => {
  const tuesday = new Date(2026, 8, 8, 9, 0, 0, 0);
  assert.equal(nextWeekly('rác', tuesday).getTime(), new Date(2026, 8, 14, 8, 0, 0, 0).getTime());
  assert.equal(nextWeekly('MON 99:99', tuesday).getTime(), new Date(2026, 8, 14, 8, 0, 0, 0).getTime());
});

test('ensureRecurring queues one weekly.report at the dueAt from weeklyReportAt', async () => {
  await getAgentSettings();
  await prisma.agentSettings.update({ where: { id: AGENT_SETTINGS_ID }, data: { weeklyReportAt: 'WED 07:15' } });
  const now = new Date(2026, 8, 8, 9, 0, 0, 0);

  await ensureRecurring(now);

  const task = await prisma.agentTask.findFirst({ where: { kind: 'weekly.report', finishedAt: null } });
  assert.ok(task, 'phải có task weekly.report đang chờ');
  assert.equal(task!.subjectType, 'system');
  assert.equal(task!.priority, 150);
  assert.equal(task!.dueAt.getTime(), new Date(2026, 8, 9, 7, 15, 0, 0).getTime());

  // Lưới an toàn chạy mỗi vòng: không được nhân bản task đang chờ.
  await ensureRecurring(new Date(now.getTime() + 60_000));
  assert.equal(await prisma.agentTask.count({ where: { kind: 'weekly.report', finishedAt: null } }), 1);
});
