// SPDX-License-Identifier: MIT

const path = require('path');
// .env.local ghi đè .env — cùng thứ tự agent/lib/env.ts đọc. Trong container, biến
// đã có sẵn từ env_file của compose nên 2 dòng dưới chỉ no-op (không tìm thấy file).
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const PORT = Number(process.env.BRIDGE_PORT ?? 4001);
const AI_ENGINE_SECRET = process.env.AI_ENGINE_SECRET?.trim() || '';
if (!AI_ENGINE_SECRET) {
  console.warn('⚠️  [BRIDGE] AI_ENGINE_SECRET chưa cấu hình — POST /detections KHÔNG xác thực (chỉ dùng cho dev).');
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

// Sức khoẻ cho agent/direct/health.ts: camera nào còn gửi detection, bao nhiêu client đang xem
app.get('/health', (_req, res) => {
  res.json({ ok: true, lastDetectionAt, clients: io.engine.clientsCount, uptimeSec: Math.round((Date.now() - startedAt) / 1000) });
});

io.on('connection', (socket) => {
  console.log('Client connected to YOLO Bridge');

  socket.on('subscribe-camera', (cameraId) => {
    socket.join(`camera-${cameraId}`);
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
