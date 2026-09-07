#!/bin/sh
# Lần chạy đầu: volume /app/data trống → chép DB đã seed (schema + Organization/Site/Camera mẫu).
set -e
if [ ! -f /app/data/dev.db ]; then
  cp /app/seed.db /app/data/dev.db
  echo "[entrypoint] Khởi tạo /app/data/dev.db từ DB seed"
fi
exec "$@"
