// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, THRESHOLDS, type HealthSignals } from '../direct/health';

const now = Date.parse('2026-09-07T10:00:00Z');
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

function base(over: Partial<HealthSignals> = {}): HealthSignals {
  return {
    now,
    bridge: { ok: true, lastDetectionAt: { 'cam-001': iso(5_000) } },
    heartbeat: { pid: 4242, at: iso(2_000), streams: 1, fps: 3.5 },
    pidAlive: true,
    snapshotBytes: 10 * 1024 * 1024,
    modelFiles: [{ required: true, present: true }],
    cameras: [{ id: 'cam-001', status: 'ONLINE', rtspUrl: 'video:samples1.mp4' }],
    overdueActionIds: [],
    ...over,
  };
}

const opts = { snapshotMaxMb: 2048, bridgeFailStreak: 0 };
const codes = (f: ReturnType<typeof decide>) => f.map(x => x.code).sort();

test('normal state detects nothing', () => {
  assert.deepEqual(decide(base(), opts), []);
});

test('camera ONLINE with no detection for > 90s yields camera.stalled; > 10 minutes sets detail.offline', () => {
  const f = decide(base({ bridge: { ok: true, lastDetectionAt: { 'cam-001': iso(THRESHOLDS.cameraStalledMs + 1) } } }), opts);
  assert.deepEqual(codes(f), ['camera.stalled']);
  assert.equal(f[0].subjectId, 'cam-001');
  assert.equal(f[0].detail.offline, false);
  const g = decide(base({ bridge: { ok: true, lastDetectionAt: {} } }), opts); // chưa từng thấy
  assert.equal(g[0].detail.offline, true);
});

test('camera OFFLINE/DEGRADED with a fresh detection yields camera.recovered', () => {
  const f = decide(base({ cameras: [{ id: 'cam-001', status: 'DEGRADED', rtspUrl: 'webcam:0' }] }), opts);
  assert.deepEqual(codes(f), ['camera.recovered']);
});

test('stale heartbeat or dead pid yields engine.stalled', () => {
  assert.deepEqual(codes(decide(base({ heartbeat: { pid: 1, at: iso(THRESHOLDS.heartbeatStaleMs + 1), streams: 1, fps: 0 } }), opts)), ['engine.stalled']);
  assert.deepEqual(codes(decide(base({ pidAlive: false }), opts)), ['engine.stalled']);
  assert.deepEqual(decide(base({ heartbeat: null }), opts), [], 'chưa từng có heartbeat = engine chưa bật, không phải treo');
});

test('a live pid that is not the engine (pidAlive=false from isEngineProcess) yields engine.stalled with detail.pidAlive=false', () => {
  const f = decide(base({ pidAlive: false }), opts);
  assert.deepEqual(codes(f), ['engine.stalled']);
  assert.equal(f[0].detail.pidAlive, false);
});

test('a hung engine (live pid, heartbeat older than 5 minutes) keeps pidAlive=true so it can still be SIGTERMed', () => {
  const f = decide(base({ heartbeat: { pid: 4242, at: iso(600_000), streams: 1, fps: 0 }, pidAlive: true }), opts);
  assert.deepEqual(codes(f), ['engine.stalled']);
  assert.equal(f[0].detail.pidAlive, true, 'kẹt trong cv2/torch vẫn phải khởi động lại được, không bị hạ về false theo tuổi heartbeat');
  assert.equal(f[0].detail.heartbeatAgeMs, 600_000);
});

test('a broken timestamp is treated as never-seen for camera and as stalled for engine', () => {
  const f = decide(base({ bridge: { ok: true, lastDetectionAt: { 'cam-001': 'không-phải-ngày' } } }), opts);
  assert.deepEqual(codes(f), ['camera.stalled']);
  assert.equal(f[0].detail.offline, true);
  assert.deepEqual(codes(decide(base({ heartbeat: { pid: 4242, at: 'hỏng', streams: 1, fps: 1 } }), opts)), ['engine.stalled']);
});

test('bridge failing 3 consecutive rounds yields bridge.down, and cameras are skipped when bridge is null', () => {
  assert.deepEqual(decide(base({ bridge: null }), { ...opts, bridgeFailStreak: 2 }), []);
  assert.deepEqual(codes(decide(base({ bridge: null }), { ...opts, bridgeFailStreak: 3 })), ['bridge.down']);
});

test('snapshot bytes over the cap yields disk.pressure; a missing required model yields model.missing', () => {
  assert.deepEqual(codes(decide(base({ snapshotBytes: 3 * 1024 * 1024 * 1024 }), opts)), ['disk.pressure']);
  assert.deepEqual(codes(decide(base({ modelFiles: [{ required: true, present: false }] }), opts)), ['model.missing']);
});
