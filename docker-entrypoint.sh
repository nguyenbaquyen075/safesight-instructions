#!/bin/sh
# Lần chạy đầu: volume /app/data trống → chép DB đã seed (schema + Organization/Site/Camera mẫu).
# mkdir -p phòng trường hợp bind mount host chưa tồn tại (Docker sẽ tự tạo bằng root nếu thiếu).
set -e
mkdir -p /app/data
if [ ! -w /app/data ]; then
  echo "[entrypoint] LỖI: /app/data không ghi được bởi uid $(id -u). Nếu dùng bind mount ./data," \
       "kiểm tra 'user:' trong docker-compose.yml khớp uid chủ thư mục trên host." >&2
  exit 1
fi
if [ ! -f /app/data/dev.db ]; then
  cp /app/seed.db /app/data/dev.db
  echo "[entrypoint] Khởi tạo /app/data/dev.db từ DB seed"
fi
exec "$@"
