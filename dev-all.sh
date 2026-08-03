#!/usr/bin/env bash
# Chạy toàn bộ hệ thống SafeSight bằng 1 lệnh: frontend + YOLO bridge + YOLO inference.
# Ctrl+C sẽ tắt tất cả tiến trình cùng lúc.
#
# Dùng: npm run dev
# (Chạy riêng lẻ: npm run dev:web | dev:bridge | dev:yolo)

cleanup() {
  echo ""
  echo "[dev] Đang tắt tất cả tiến trình..."
  # Tắt cả nhóm tiến trình con
  kill 0 2>/dev/null
}
trap cleanup EXIT INT TERM

echo "[dev] 🚀 Khởi động SafeSight (frontend + bridge + YOLO)..."

# 0) Dọn cổng cũ (4001 bridge + 3000 next dev zombie) tránh xung đột "cổng đang bận"
lsof -ti:4001 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1   # chờ hệ điều hành nhả cổng, tránh EADDRINUSE / "port in use"

# 1) YOLO Bridge — nhận detection từ Python, phát qua Socket.IO (port 4001)
node ai-engine/yolo_bridge.js &

# 2) YOLO inference — chạy model thật (ưu tiên python trong .venv)
if [ -x ".venv/bin/python" ]; then
  .venv/bin/python ai-engine/yolo_inference.py &
else
  echo "[dev] ⚠️  Chưa có .venv — bỏ qua YOLO inference."
  echo "[dev]     Tạo venv + cài thư viện rồi chạy: npm run dev:yolo"
fi

# 3) Frontend Next.js (giữ ở foreground; Ctrl+C tại đây tắt cả nhóm)
next dev
