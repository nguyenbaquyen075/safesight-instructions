// SPDX-License-Identifier: MIT

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

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

// Loa công trường tự đọc vi phạm: server Next gọi vào đây khi engine chốt vi phạm. Chỉ phát
// cho trang loa (room speaker-<id>), mỗi camera tối thiểu ANNOUNCE_COOLDOWN_MS mới đọc lại
// để nhiều người vi phạm cùng lúc không đọc chồng. Không có loa nào nghe thì bỏ qua và
// KHÔNG tính vào thời gian chờ.
const ANNOUNCE_COOLDOWN_MS = Number(process.env.ANNOUNCE_COOLDOWN_MS) || 30000;
const lastAnnounceAt = {};
app.post('/announce', (req, res) => {
  const { cameraId, text } = req.body || {};
  if (typeof cameraId !== 'string' || !cameraId || typeof text !== 'string' || !text.trim() || text.length > 300) {
    return res.sendStatus(400);
  }
  const room = `speaker-${cameraId}`;
  if (!io.sockets.adapter.rooms.get(room)?.size) return res.status(202).json({ skipped: 'no-speaker' });
  const now = Date.now();
  if (now - (lastAnnounceAt[cameraId] || 0) < ANNOUNCE_COOLDOWN_MS) return res.status(429).json({ throttled: true });
  lastAnnounceAt[cameraId] = now;
  io.to(room).emit('announce', { cameraId, text });
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

  // Trang "Loa công trường" vào room riêng để /announce biết có loa đang nghe hay không
  // (room camera-<id> còn gồm cả tab chỉ xem camera).
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
    console.error('⚠️  [BRIDGE] Cổng 4001 đang bận — thử lại sau 1.5s...');
    setTimeout(() => {
      try { server.close(); } catch (e) {}
      server.listen(4001);
    }, 1500);
  } else {
    throw err;
  }
});

server.listen(4001, () => {
  console.log('✅ YOLO Bridge Server running on port 4001');
});
