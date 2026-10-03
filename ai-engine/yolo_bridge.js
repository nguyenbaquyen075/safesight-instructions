// SPDX-License-Identifier: MIT

const path = require('path');
// .env.local ghi đè .env — cùng thứ tự agent/lib/env.ts đọc. Trong container, biến
// đã có sẵn từ env_file của compose nên 2 dòng dưới chỉ no-op (không tìm thấy file).
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const PORT = Number(process.env.BRIDGE_PORT) || 4001;
// Hai câu loa liên tiếp của cùng một camera phải cách nhau ít nhất chừng này (trừ khi force):
// engine báo lại mỗi 60s, agent review lại thường vài chục giây sau -> không đọc trùng một câu.
const ANNOUNCE_COOLDOWN_MS = Number(process.env.ANNOUNCE_COOLDOWN_MS) || 30_000;
const AI_ENGINE_SECRET = process.env.AI_ENGINE_SECRET?.trim() || '';
if (!AI_ENGINE_SECRET) {
  console.warn('⚠️  [BRIDGE] AI_ENGINE_SECRET chưa cấu hình — POST /detections và POST /announce KHÔNG xác thực (chỉ dùng cho dev).');
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Gửi detection theo ROOM riêng từng camera (thay vì io.emit() broadcast toàn cục
// trước đây) -> client chỉ xem 1 camera không còn nhận data của mọi camera khác.
// Vẫn giữ room 'all-cameras' cho client cần theo dõi TẤT CẢ cùng lúc (vd trang tổng
// quan quét vi phạm mọi camera để bắn notification).
const lastDetectionAt = {};   // cameraId -> thời điểm nhận detection gần nhất (cho agent/health)
const startedAt = Date.now();

app.use(express.json());
app.post('/detections', (req, res) => {
  if (AI_ENGINE_SECRET && req.headers['x-ai-engine-secret'] !== AI_ENGINE_SECRET) {
    return res.sendStatus(401);
  }
  const { cameraId, detections, videoPos } = req.body;
  lastDetectionAt[cameraId] = new Date().toISOString();
  const targets = [`camera-${cameraId}`, 'all-cameras'];
  io.to(targets).emit('yolo-data', { cameraId, detections, videoPos });

  // Check for violations to trigger UI alerts
  const violation = detections.find(d => d.isViolation);
  if (violation) {
    io.to(targets).emit('new-violation', { cameraId, ...violation });
  }
  res.sendStatus(200);
});

// Loa công trường: dashboard/agent đẩy một câu, bridge phát cho thiết bị đang mở
// /site-speaker của camera đó. Loa nằm trong room riêng `speaker-<id>` (không lẫn với tab chỉ
// xem camera ở `camera-<id>`), nên `listeners` là số thiết bị loa thật sự đang nghe.
const lastAnnounceAt = {};   // cameraId -> lần phát gần nhất (cho cooldown)
app.post('/announce', (req, res) => {
  if (AI_ENGINE_SECRET && req.headers['x-ai-engine-secret'] !== AI_ENGINE_SECRET) {
    return res.sendStatus(401);
  }
  const { cameraId, text, force } = req.body || {};
  // Bridge là ranh giới tin cậy cuối trước loa: kiểm kiểu và độ dài ở đây, không tin route/tool phía trên.
  if (typeof cameraId !== 'string' || !cameraId.trim() || typeof text !== 'string' || !text.trim() || text.length > 200) {
    return res.status(400).json({ ok: false, error: 'cameraId và text (1–200 ký tự) là bắt buộc' });
  }
  const room = `speaker-${cameraId}`;
  const listeners = io.sockets.adapter.rooms.get(room)?.size ?? 0;
  // Không có loa nào nghe thì không phát và KHÔNG tính cooldown: lúc có người mở loa, vi phạm kế tiếp phát ngay.
  if (listeners === 0) return res.json({ ok: true, listeners: 0 });
  // force (người bấm tay) luôn được phát; tự động/agent phải chờ hết cooldown của camera.
  const sinceLast = Date.now() - (lastAnnounceAt[cameraId] ?? 0);
  if (force !== true && sinceLast < ANNOUNCE_COOLDOWN_MS) {
    return res.status(429).json({ ok: false, throttled: true, error: 'camera này vừa phát loa', retryInMs: ANNOUNCE_COOLDOWN_MS - sinceLast });
  }
  lastAnnounceAt[cameraId] = Date.now();
  io.to(room).emit('voice-announce', { cameraId, text, at: new Date().toISOString() });
  res.json({ ok: true, listeners });
});

// Sức khoẻ cho agent/direct/health.ts: camera nào còn gửi detection, bao nhiêu client đang xem
app.get('/health', (_req, res) => {
  res.json({ ok: true, lastDetectionAt, clients: io.engine.clientsCount, uptimeSec: Math.round((Date.now() - startedAt) / 1000) });
});

io.on('connection', (socket) => {
  console.log('Client connected to YOLO Bridge');

  socket.on('subscribe-camera', (cameraId) => {
    socket.join(`camera-${cameraId}`);
  });

  // Thiết bị loa công trường (/site-speaker) — tách khỏi subscribe-camera để đếm đúng số loa.
  socket.on('subscribe-speaker', (cameraId) => {
    socket.join(`speaker-${cameraId}`);
  });

  socket.on('subscribe-all', () => {
    socket.join('all-cameras');
  });

  // ponytail: không có auth/kiểm tra cameraId ở đây (cả app cũng chưa có auth
  // gate cấp route) — thêm shared-secret hoặc xác thực trước khi mở bridge
  // này ra ngoài localhost/máy demo.
  socket.on('voice-broadcast', ({ cameraId, audio, mimeType }, ack) => {
    io.to(`camera-${cameraId}`).emit('voice-broadcast', { cameraId, audio, mimeType });
    if (typeof ack === 'function') ack();
  });
});

// Nếu cổng đang bận (zombie chưa nhả), thử lại thay vì crash âm thầm
server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`⚠️  [BRIDGE] Cổng ${PORT} đang bận — thử lại sau 1.5s...`);
    setTimeout(() => {
      try { server.close(); } catch (e) {}
      server.listen(PORT);
    }, 1500);
  } else {
    throw err;
  }
});

server.listen(PORT, () => {
  console.log(`✅ YOLO Bridge Server running on port ${PORT}`);
});
