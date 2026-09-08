// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { makeListCameraAgents } from '../tools/list_camera_agents';
import { makeDispatchToCamera } from '../tools/dispatch_to_camera';
import { getCameraAgent, localDay, parseMemory, rememberCamera } from '../lib/camera-agent';
import { LIMITS } from '../lib/guard';
import { PRIORITY } from '../lib/tasks';
import { toolsFor } from '../lib/toolsets';
import { preambleFor } from '../lib/preamble';
import { runResearch } from '../research/index';
import type { SessionClient } from '../session';
import type { LeasedTask } from '../lib/tasks';
import type { ToolContext } from '../lib/tool-context';

// Điều phối subagent theo camera từ một phiên toàn hệ thống: xem danh sách subagent
// (list_camera_agents) và giao việc (dispatch_to_camera → task camera.instruction + ghi trí nhớ).

const CAM_A = 'cam-orch-a';
const CAM_B = 'cam-orch-b';
const SESSION = 's-orch';

const ctx = (): ToolContext => ({
  sessionId: SESSION, taskId: null, taskKind: 'ask', budget: 6, cameraId: null,
  spent: { calls: 0, escalations: 0, followups: 0, remembers: 0, verdicts: new Set() },
});
const list = async () => JSON.parse((await makeListCameraAgents(ctx()).run({})) as string);
const dispatch = async (input: { cameraId: string; instruction: string; minutes?: number }, c: ToolContext = ctx()) =>
  JSON.parse((await makeDispatchToCamera(c).run(input)) as string);

test.before(async () => {
  await prisma.organization.upsert({ where: { id: 'org-orch' }, update: {}, create: { id: 'org-orch', name: 'Orch Org' } });
  await prisma.site.upsert({ where: { id: 'site-orch' }, update: {}, create: { id: 'site-orch', orgId: 'org-orch', name: 'Site Orch', address: 'x', lat: 0, lng: 0 } });
  for (const [id, name] of [[CAM_A, 'Cam A'], [CAM_B, 'Cam B']]) {
    await prisma.camera.upsert({ where: { id }, update: {}, create: { id, siteId: 'site-orch', name, rtspUrl: 'video:samples1.mp4', location: 'gate', status: 'ONLINE' } });
  }
});
test.beforeEach(async () => {
  await prisma.agentTask.deleteMany({ where: { subjectId: { in: [CAM_A, CAM_B] } } });
  await prisma.agentEvent.deleteMany({ where: { OR: [{ sessionId: SESSION }, { subjectId: { in: [CAM_A, CAM_B] } }] } });
  await prisma.cameraAgent.deleteMany({ where: { id: { in: [CAM_A, CAM_B] } } });
  await prisma.cameraAgent.create({ data: { id: CAM_A, usageDay: localDay(), tokensUsedToday: 1234 } });
  await prisma.cameraAgent.create({ data: { id: CAM_B, usageDay: localDay(), isEnabled: false } });
});

test('list_camera_agents lists every camera with its subagent state, open violations and the latest notes', async () => {
  for (let i = 0; i < 4; i++) await rememberCamera(CAM_A, `ghi chú ${i}`, 'older');
  await prisma.violation.deleteMany({ where: { cameraId: CAM_A } });
  await prisma.violation.create({ data: { cameraId: CAM_A, siteId: 'site-orch', type: 'hard_hat', severity: 'high', confidence: 0.9, bboxData: '[]', snapshotUrl: '/snapshots/orch.jpg', detectedAt: new Date() } }); // status mặc định 'OPEN' (DB lưu chữ HOA)
  await prisma.violation.create({ data: { cameraId: CAM_A, siteId: 'site-orch', type: 'hard_hat', severity: 'high', confidence: 0.9, bboxData: '[]', snapshotUrl: '/snapshots/orch2.jpg', detectedAt: new Date(), status: 'RESOLVED' } });
  const out = await list();
  const a = out.cameras.find((c: { cameraId: string }) => c.cameraId === CAM_A);
  const b = out.cameras.find((c: { cameraId: string }) => c.cameraId === CAM_B);
  assert.equal(a.name, 'Cam A');
  assert.equal(a.isEnabled, true);
  assert.equal(a.tokensUsedToday, 1234);
  assert.equal(a.openViolations, 1);
  assert.equal(a.status, 'online'); // chữ thường cho model, như các tool đọc khác
  assert.equal(b.dailyTokenCap, 300000); // mặc định schema, không phải null
  assert.deepEqual(a.notes, ['ghi chú 1', 'ghi chú 2', 'ghi chú 3']); // 3 ghi chú mới nhất, cũ → mới
  assert.equal(b.isEnabled, false);
  assert.deepEqual(b.notes, []);
});

test('dispatch_to_camera queues a camera.instruction task, remembers the instruction and logs an action', async () => {
  const out = await dispatch({ cameraId: CAM_A, instruction: 'Chiều nay để ý người không mũ ở cổng B' });
  assert.equal(out.dispatched, true);
  const task = await prisma.agentTask.findFirst({ where: { kind: 'camera.instruction', subjectType: 'camera', subjectId: CAM_A, finishedAt: null } });
  assert.ok(task, 'phải có task camera.instruction đang chờ');
  assert.equal(task!.reason, 'Chiều nay để ý người không mũ ở cổng B');
  assert.equal(task!.priority, PRIORITY['camera.instruction']);
  assert.ok(task!.dueAt.getTime() <= Date.now() + 1000, 'mặc định chạy ngay');
  const notes = parseMemory((await getCameraAgent(CAM_A)).memory);
  assert.equal(notes.length, 1);
  assert.match(notes[0].text, /Chỉ dẫn.*cổng B/);
  const ev = await prisma.agentEvent.findFirst({ where: { sessionId: SESSION, type: 'action' } });
  assert.equal(JSON.parse(ev!.data).action, 'dispatch_to_camera');
});

test('dispatch_to_camera honours minutes, refuses a disabled subagent and an unknown camera, and stops at the per-session limit', async () => {
  const later = await dispatch({ cameraId: CAM_A, instruction: 'Tổng hợp lại sau khi hết ca chiều', minutes: 60 });
  assert.equal(later.dispatched, true);
  assert.ok(new Date(later.dueAt).getTime() > Date.now() + 55 * 60_000);
  const off = await dispatch({ cameraId: CAM_B, instruction: 'Camera này đang tắt subagent' });
  assert.equal(off.dispatched, false);
  assert.match(off.blockedReason, /tắt/);
  const missing = await dispatch({ cameraId: 'cam-does-not-exist', instruction: 'Không có camera này đâu' });
  assert.equal(missing.dispatched, false);
  assert.match(missing.blockedReason, /không tồn tại/);
  const c = ctx();
  for (let i = 0; i < LIMITS.followupPerSession; i++) assert.equal((await dispatch({ cameraId: CAM_A, instruction: `Chỉ dẫn số ${i} cho camera A` }, c)).dispatched, true);
  const capped = await dispatch({ cameraId: CAM_A, instruction: 'Chỉ dẫn vượt hạn mức phiên' }, c);
  assert.equal(capped.dispatched, false);
  assert.ok(capped.blockedReason);
});

test('a second dispatch to the same camera replaces the pending instruction instead of queuing a duplicate', async () => {
  const first = await dispatch({ cameraId: CAM_A, instruction: 'Chỉ dẫn thứ nhất cho camera A' });
  assert.equal(first.replacedPending, false);
  const second = await dispatch({ cameraId: CAM_A, instruction: 'Chỉ dẫn thứ hai thay chỉ dẫn thứ nhất' });
  assert.equal(second.replacedPending, true);
  const pending = await prisma.agentTask.findMany({ where: { kind: 'camera.instruction', subjectType: 'camera', subjectId: CAM_A, finishedAt: null } });
  assert.equal(pending.length, 1);
  assert.equal(pending[0].reason, 'Chỉ dẫn thứ hai thay chỉ dẫn thứ nhất');
});

test('a camera.instruction task runs a session even when the camera has no new activity', async () => {
  const task: LeasedTask = { id: 'task-orch-instr', kind: 'camera.instruction', subjectType: 'camera', subjectId: CAM_A, reason: 'Kiểm tra góc máy', budget: 6, attempts: 1, priority: 60, dueAt: new Date() };
  const client: SessionClient = { async *run() { yield { content: [{ type: 'text', text: 'Đã kiểm tra góc máy.' }], usage: { input_tokens: 50, output_tokens: 5 }, stop_reason: 'end_turn' }; } };
  const outcome = await runResearch(task, { client });
  assert.equal(outcome, 'Đã kiểm tra góc máy.');
  assert.equal(await prisma.agentEvent.count({ where: { taskId: task.id, type: 'session.started' } }), 1);
  await prisma.agentEvent.deleteMany({ where: { taskId: task.id } });
});

test('system-level sessions get the orchestration tools and preamble; camera-bound review sessions do not', async () => {
  const names = (kind: string, cameraId: string | null) => toolsFor(kind, { ...ctx(), taskKind: kind, cameraId }).map(t => t.name);
  assert.ok(names('ask', null).includes('list_camera_agents') && names('ask', null).includes('dispatch_to_camera'));
  assert.ok(names('shift.report', null).includes('list_camera_agents'));
  assert.ok(!names('violation.review', CAM_A).includes('dispatch_to_camera'));
  assert.ok(!names('camera.instruction', CAM_A).includes('dispatch_to_camera'));
  // ask từ modal camera/vi phạm chạy dưới subagent camera đó: không được điều phối camera khác
  assert.ok(!names('ask', CAM_A).includes('dispatch_to_camera') && !names('ask', CAM_A).includes('list_camera_agents'));
  const system = await preambleFor({ id: 't', kind: 'ask', subjectType: 'system', subjectId: null, reason: 'hỏi', budget: 6, attempts: 1, priority: 500, dueAt: new Date() }, { userMessage: 'cam nào đang bận?' });
  assert.match(system, /list_camera_agents/);
  const bound = await preambleFor({ id: 't2', kind: 'camera.instruction', subjectType: 'camera', subjectId: CAM_A, reason: 'Kiểm tra góc máy', budget: 6, attempts: 1, priority: 60, dueAt: new Date() }, { cameraId: CAM_A });
  assert.match(bound, /CHỈ DẪN/);
  assert.doesNotMatch(bound, /list_camera_agents/);
});
