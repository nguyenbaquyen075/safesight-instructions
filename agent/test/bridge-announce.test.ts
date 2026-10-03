// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { io, type Socket } from 'socket.io-client';

// Bridge thật chạy ở cổng riêng: loa phải nằm trong room riêng (không lẫn tab chỉ xem
// camera) và /announce có cooldown theo camera, trừ khi người bấm tay (force).

const PORT = 4911;
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = 'bridge-test-secret';
const COOLDOWN_MS = 500;
const CAM = 'cam-bridge-t';

let bridge: ChildProcess;
const sockets: Socket[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function say(text: string, extra: Record<string, unknown> = {}, secret: string | null = SECRET, cameraId = CAM) {
  const res = await fetch(`${BASE}/announce`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(secret ? { 'x-ai-engine-secret': secret } : {}) },
    body: JSON.stringify({ cameraId, text, ...extra }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) as Record<string, unknown> };
}

// Client giả: vào room bằng sự kiện subscribe-* và gom mọi câu loa nhận được.
async function client(subscribeEvent: 'subscribe-speaker' | 'subscribe-camera', cameraId = CAM) {
  const s = io(BASE, { transports: ['websocket'] });
  const heard: string[] = [];
  s.on('voice-announce', (d: { text: string }) => heard.push(d.text));
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`socket did not connect to ${BASE}`)), 3000);
    s.on('connect', () => { clearTimeout(timer); resolve(); });
  });
  s.emit(subscribeEvent, cameraId);
  await sleep(150);
  sockets.push(s);
  return { s, heard };
}

test.before(async () => {
  bridge = spawn(process.execPath, ['ai-engine/yolo_bridge.js'], {
    env: { ...process.env, BRIDGE_PORT: String(PORT), AI_ENGINE_SECRET: SECRET, ANNOUNCE_COOLDOWN_MS: String(COOLDOWN_MS) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('bridge did not start')), 10_000);
    bridge.stdout!.on('data', (chunk) => { if (String(chunk).includes(`running on port ${PORT}`)) { clearTimeout(timer); resolve(); } });
    bridge.on('exit', (code) => reject(new Error(`bridge exited early (${code})`)));
  });
});

test.after(() => {
  for (const s of sockets) s.disconnect();
  bridge?.kill();
});

test('a tab that only watches the camera is not counted as a speaker and hears nothing', async () => {
  const viewer = await client('subscribe-camera');
  const out = await say('Câu thử cho tab xem camera');
  assert.equal(out.status, 200);
  assert.equal(out.body.listeners, 0);
  assert.deepEqual(viewer.heard, []);
  viewer.s.disconnect();
});

test('announcing with no speaker listening succeeds with listeners 0 and does not start the cooldown', async () => {
  const none = await say('Chưa ai nghe');
  assert.deepEqual([none.status, none.body.listeners], [200, 0]);
  const speaker = await client('subscribe-speaker');
  const out = await say('Có loa rồi, phát ngay');
  assert.equal(out.status, 200); // không bị 429 dù vừa gọi một lần trước đó
  assert.equal(out.body.listeners, 1);
  assert.deepEqual(speaker.heard, ['Có loa rồi, phát ngay']);
  speaker.s.disconnect();
});

test('a second announcement inside the cooldown is throttled, a forced one is not, and it frees up after the cooldown', async () => {
  const speaker = await client('subscribe-speaker', 'cam-bridge-cd');
  const first = await say('Lần một', {}, SECRET, 'cam-bridge-cd');
  assert.equal(first.status, 200);

  const throttled = await say('Lần hai quá sớm', {}, SECRET, 'cam-bridge-cd');
  assert.equal(throttled.status, 429);
  assert.equal(throttled.body.throttled, true);

  const forced = await say('Người bấm tay luôn được phát', { force: true }, SECRET, 'cam-bridge-cd');
  assert.equal(forced.status, 200);

  await sleep(COOLDOWN_MS + 150);
  const later = await say('Sau cooldown', {}, SECRET, 'cam-bridge-cd');
  assert.equal(later.status, 200);
  assert.deepEqual(speaker.heard, ['Lần một', 'Người bấm tay luôn được phát', 'Sau cooldown']);
  speaker.s.disconnect();
});

test('the cooldown is per camera', async () => {
  const a = await client('subscribe-speaker', 'cam-bridge-a');
  const b = await client('subscribe-speaker', 'cam-bridge-b');
  assert.equal((await say('Camera A', {}, SECRET, 'cam-bridge-a')).status, 200);
  assert.equal((await say('Camera B', {}, SECRET, 'cam-bridge-b')).status, 200);
  assert.deepEqual([a.heard, b.heard], [['Camera A'], ['Camera B']]);
  a.s.disconnect(); b.s.disconnect();
});

test('a wrong or missing secret is rejected before anything is spoken', async () => {
  assert.equal((await say('x'.repeat(10), {}, 'wrong')).status, 401);
  assert.equal((await say('x'.repeat(10), {}, null)).status, 401);
});
