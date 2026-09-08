// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFindings, type ActionContext } from '../direct/actions';
import { decide, findOverdueActions, type HealthSignals } from '../direct/health';
import { prisma } from '../lib/db';
import {
  DEFAULT_DUE_MS,
  createActionSchema,
  isOverdue,
  toActionDTO,
  updateActionSchema,
} from '@/lib/corrective-action-shape';

const ORG = 'org-capa';
const SITE = 'site-capa';
const CAM = 'cam-capa-t';
const VIOLATION = 'vio-capa-t';
const HOUR = 3_600_000;

test('createActionSchema accepts a valid assignment and defaults the due date to 24 hours ahead', () => {
  const before = Date.now();
  const parsed = createActionSchema.safeParse({ assigneeName: 'Trần Văn B', description: 'Phát mũ bảo hộ cho tổ 2' });
  assert.ok(parsed.success, JSON.stringify(parsed.error?.issues));
  assert.equal(parsed.data.assigneeId, undefined);
  const drift = parsed.data.dueAt.getTime() - (before + DEFAULT_DUE_MS);
  assert.ok(Math.abs(drift) < 5_000, `hạn mặc định phải là +24h, lệch ${drift}ms`);
});

test('createActionSchema rejects a short name, a short description and a due date in the past', () => {
  assert.equal(createActionSchema.safeParse({ assigneeName: 'A', description: 'Phát mũ bảo hộ' }).success, false);
  assert.equal(createActionSchema.safeParse({ assigneeName: 'Trần Văn B', description: 'ngắn' }).success, false);
  assert.equal(
    createActionSchema.safeParse({ assigneeName: 'Trần Văn B', description: 'Phát mũ bảo hộ', dueAt: new Date(Date.now() - HOUR).toISOString() }).success,
    false,
  );
  assert.equal(
    createActionSchema.safeParse({ assigneeName: 'Trần Văn B', description: 'Phát mũ bảo hộ', dueAt: 'không phải ngày' }).success,
    false,
  );
});

test('updateActionSchema accepts a status with an optional evidence note and rejects an unknown status', () => {
  const ok = updateActionSchema.safeParse({ status: 'DONE', evidenceNote: 'Đã phát đủ 12 mũ' });
  assert.ok(ok.success);
  assert.equal(ok.data.evidenceNote, 'Đã phát đủ 12 mũ');
  assert.ok(updateActionSchema.safeParse({ status: 'CANCELLED' }).success);
  assert.equal(updateActionSchema.safeParse({ status: 'FINISHED' }).success, false);
});

test('isOverdue only flags OPEN actions past their due date', () => {
  const now = Date.parse('2026-09-08T10:00:00Z');
  const past = new Date(now - HOUR);
  const future = new Date(now + HOUR);
  assert.equal(isOverdue({ status: 'OPEN', dueAt: past }, now), true);
  assert.equal(isOverdue({ status: 'OPEN', dueAt: future }, now), false);
  assert.equal(isOverdue({ status: 'DONE', dueAt: past }, now), false);
  assert.equal(isOverdue({ status: 'CANCELLED', dueAt: past }, now), false);
});

test('toActionDTO serializes dates and carries the overdue flag', () => {
  const now = Date.parse('2026-09-08T10:00:00Z');
  const dto = toActionDTO({
    id: 'act-1', violationId: VIOLATION, siteId: SITE, assigneeId: null, assigneeName: 'Trần Văn B',
    description: 'Phát mũ bảo hộ', dueAt: new Date(now - HOUR), status: 'OPEN', evidenceNote: null,
    completedAt: null, escalatedAt: null, createdById: 'user-1', createdAt: new Date(now - 2 * HOUR),
  }, now);
  assert.equal(dto.assigneeId, undefined);
  assert.equal(dto.dueAt, new Date(now - HOUR).toISOString());
  assert.equal(dto.overdue, true);
  assert.equal(dto.completedAt, undefined);
});

function signals(over: Partial<HealthSignals> = {}): HealthSignals {
  const now = Date.now();
  return {
    now,
    bridge: { ok: true, lastDetectionAt: { [CAM]: new Date(now - 5_000).toISOString() } },
    heartbeat: null,
    pidAlive: false,
    snapshotBytes: 0,
    modelFiles: [{ required: true, present: true }],
    cameras: [{ id: CAM, status: 'ONLINE', rtspUrl: 'video:samples1.mp4' }],
    overdueActions: [],
    ...over,
  };
}

const opts = { snapshotMaxMb: 2048, bridgeFailStreak: 0 };

test('decide emits capa.overdue only when there is at least one overdue corrective action', () => {
  assert.deepEqual(decide(signals(), opts), []);
  const overdue = [{ id: 'act-1', violationId: VIOLATION, cameraId: CAM, assigneeName: 'Trần Văn B', dueAt: new Date(Date.now() - HOUR).toISOString() }];
  const findings = decide(signals({ overdueActions: overdue }), opts);
  assert.deepEqual(findings.map(f => f.code), ['capa.overdue']);
  assert.equal(findings[0].subjectType, 'system');
  assert.equal(findings[0].detail.count, 1);
});

test.before(async () => {
  await prisma.organization.upsert({ where: { id: ORG }, update: {}, create: { id: ORG, name: 'CAPA Org' } });
  await prisma.site.upsert({ where: { id: SITE }, update: {}, create: { id: SITE, orgId: ORG, name: 'Site CAPA', address: 'x', lat: 0, lng: 0 } });
  await prisma.camera.upsert({ where: { id: CAM }, update: {}, create: { id: CAM, siteId: SITE, name: 'Cam CAPA', rtspUrl: 'video:samples1.mp4', location: 'gate', status: 'ONLINE' } });
  await prisma.violation.upsert({
    where: { id: VIOLATION }, update: {},
    create: { id: VIOLATION, cameraId: CAM, siteId: SITE, type: 'no_helmet', severity: 'high', confidence: 0.9, bboxData: '[]', snapshotUrl: '/x.jpg' },
  });
});

test('findOverdueActions returns OPEN actions past due that were never escalated, and applyFindings escalates each of them exactly once', async () => {
  await prisma.correctiveAction.deleteMany({ where: { violationId: VIOLATION } });
  await prisma.agentTask.deleteMany({ where: { kind: 'ops.escalate' } });
  const past = new Date(Date.now() - HOUR);
  await prisma.correctiveAction.createMany({
    data: [
      { id: 'act-capa-1', violationId: VIOLATION, siteId: SITE, assigneeName: 'Trần Văn B', description: 'Phát mũ bảo hộ', dueAt: past, createdById: 'user-capa' },
      { id: 'act-capa-2', violationId: VIOLATION, siteId: SITE, assigneeName: 'Lê Thị C', description: 'Rào lại lối vào', dueAt: past, createdById: 'user-capa' },
      { id: 'act-capa-3', violationId: VIOLATION, siteId: SITE, assigneeName: 'Đã xong', description: 'Việc đã khắc phục', dueAt: past, status: 'DONE', completedAt: new Date(), createdById: 'user-capa' },
      { id: 'act-capa-4', violationId: VIOLATION, siteId: SITE, assigneeName: 'Chưa tới hạn', description: 'Việc còn hạn', dueAt: new Date(Date.now() + HOUR), createdById: 'user-capa' },
    ],
  });

  const first = (await findOverdueActions()).filter(a => a.violationId === VIOLATION);
  assert.deepEqual(first.map(a => a.id).sort(), ['act-capa-1', 'act-capa-2']);
  assert.equal(first[0].cameraId, CAM);

  const ctx: ActionContext = { sessionId: 'test-capa-overdue', taskId: 'test-task-capa', repeats: new Map(), paused: false };
  await applyFindings(decide(signals({ overdueActions: first }), opts), ctx);

  assert.equal(await prisma.agentTask.count({ where: { kind: 'ops.escalate', finishedAt: null } }), 1, 'chỉ được tạo đúng một task ops.escalate');
  const escalated = await prisma.correctiveAction.findMany({ where: { id: { in: ['act-capa-1', 'act-capa-2'] } }, select: { escalatedAt: true } });
  assert.ok(escalated.every(a => a.escalatedAt !== null), 'mọi việc đã liệt kê phải được đánh dấu escalatedAt');

  // Vòng quét thứ hai: việc đã leo thang không được báo lại, và không sinh thêm task nào.
  const second = (await findOverdueActions()).filter(a => a.violationId === VIOLATION);
  assert.deepEqual(second, []);
  await applyFindings(decide(signals({ overdueActions: second }), opts), ctx);
  assert.equal(await prisma.agentTask.count({ where: { kind: 'ops.escalate', finishedAt: null } }), 1);
});

test('applyFindings names at most five overdue actions in the escalation reason', async () => {
  await prisma.agentTask.deleteMany({ where: { kind: 'ops.escalate' } });
  const overdueActions = Array.from({ length: 7 }, (_, i) => ({
    id: `act-many-${i}`, violationId: VIOLATION, cameraId: CAM, assigneeName: `Người ${i}`, dueAt: new Date(Date.now() - HOUR).toISOString(),
  }));
  const ctx: ActionContext = { sessionId: 'test-capa-many', taskId: 'test-task-capa-many', repeats: new Map(), paused: false };
  await applyFindings(decide(signals({ overdueActions }), opts), ctx);
  const task = await prisma.agentTask.findFirst({ where: { kind: 'ops.escalate', finishedAt: null } });
  assert.ok(task);
  assert.match(task.reason, /7/);
  assert.ok(task.reason.includes('Người 4'), 'phải liệt kê 5 việc đầu');
  assert.ok(!task.reason.includes('Người 5'), 'không được liệt kê quá 5 việc');
});
