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

echo "[dev] 🚀 Khởi động SafeSight (frontend + bridge + YOLO + agent)..."

# 0) Dọn cổng cũ (4001 bridge + 3000 next dev zombie) tránh xung đột "cổng đang bận"
lsof -ti:4001 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1   # chờ hệ điều hành nhả cổng, tránh EADDRINUSE / "port in use"

# 1) YOLO Bridge — nhận detection từ Python, phát qua Socket.IO (port 4001)
node ai-engine/yolo_bridge.js &

# 2) YOLO inference — chạy model thật (ưu tiên python trong .venv).
#    Bọc trong vòng until: tiến trình thoát (kể cả do agent gửi SIGTERM khi treo) thì tự chạy lại sau 2s.
if [ -x ".venv/bin/python" ]; then
  (until .venv/bin/python ai-engine/yolo_inference.py; do echo "[dev] AI engine thoát, chạy lại sau 2s..."; sleep 2; done) &
else
  echo "[dev] ⚠️  Chưa có .venv — bỏ qua YOLO inference."
  echo "[dev]     Tạo venv + cài thư viện rồi chạy: npm run dev:yolo"
fi

# 2b) Agent — trực vận hành + cán bộ an toàn (port 4002). Thiếu ANTHROPIC_API_KEY vẫn chạy lane trực tiếp.
lsof -ti:4002 2>/dev/null | xargs kill -9 2>/dev/null || true
#    Bọc trong vòng until giống AI engine: agent thoát vì lỗi gì cũng tự chạy lại sau 2s.
(until npx tsx agent/main.ts; do echo "[dev] agent thoát, chạy lại sau 2s..."; sleep 2; done) &

# 3) Frontend Next.js (giữ ở foreground; Ctrl+C tại đây tắt cả nhóm)
next dev
