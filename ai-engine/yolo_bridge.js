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
app.use(express.json());
app.post('/detections', (req, res) => {
  const { cameraId, detections } = req.body;
  const targets = [`camera-${cameraId}`, 'all-cameras'];
  io.to(targets).emit('yolo-data', { cameraId, detections });

  // Check for violations to trigger UI alerts
  const violation = detections.find(d => d.isViolation);
  if (violation) {
    io.to(targets).emit('new-violation', { cameraId, ...violation });
  }
  res.sendStatus(200);
});

io.on('connection', (socket) => {
  console.log('Client connected to YOLO Bridge');

  socket.on('subscribe-camera', (cameraId) => {
    socket.join(`camera-${cameraId}`);
  });

  socket.on('subscribe-all', () => {
    socket.join('all-cameras');
  });

  socket.on('voice-broadcast', ({ cameraId, audio, mimeType }) => {
    io.to(`camera-${cameraId}`).emit('voice-broadcast', { cameraId, audio, mimeType });
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
