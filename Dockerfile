# syntax=docker/dockerfile:1
# SPDX-License-Identifier: MIT
#
# Hai image từ một Dockerfile (chọn bằng --target):
#   dashboard  Next.js dashboard + API (cổng 3000), SQLite ở /app/data/dev.db
#   bridge     YOLO Bridge Socket.IO (cổng 4001)
# AI engine (Python/YOLOv8) và agent chạy ngoài container vì cần model .pt và GPU/webcam.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
# Mặc định dựng bản SQLite. Bản PostgreSQL:
#   --build-arg PRISMA_SCHEMA=prisma/postgres/schema.prisma
#   --build-arg BUILD_DATABASE_URL=postgresql://build/build
# (docker-compose.yml đọc hai giá trị này từ .env). Prisma 7 nhúng query compiler theo provider
# của schema lúc generate, nên MỘT client chỉ nói được một loại DB — phải chọn ngay ở bước build.
# BUILD_DATABASE_URL chỉ để src/lib/prisma.ts chọn đúng adapter lúc `next build` nạp module; không
# có kết nối DB nào ở bước này (next build chạy TRƯỚC db push, tức lúc chưa có file dev.db nào).
ARG PRISMA_SCHEMA=prisma/schema.prisma
ARG BUILD_DATABASE_URL=file:./data/dev.db
ENV NEXT_TELEMETRY_DISABLED=1 DATABASE_URL=${BUILD_DATABASE_URL}
COPY . .
RUN npx prisma generate --schema "$PRISMA_SCHEMA" \
 && npm run build \
 && mkdir -p data \
 && if [ "$PRISMA_SCHEMA" = "prisma/schema.prisma" ]; then npx prisma db push && npm run db:seed; else touch data/dev.db; fi

FROM node:24-alpine AS dashboard
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 DATABASE_URL=file:./data/dev.db
RUN addgroup -S app && adduser -S app -G app && mkdir -p data public
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/data/dev.db ./seed.db
COPY --chown=app:app docker-entrypoint.sh ./
# ./data và ./public/snapshots (bind mount, xem docker-compose.yml) đều phải ghi được bởi bất kỳ
# uid nào — compose chạy dashboard bằng uid:gid của host, không phải "app". 777 chấp nhận được vì
# đây là thư mục dữ liệu bind mount ra ngoài host, không phải mã nguồn image.
RUN mkdir -p public/snapshots && chmod 777 data public/snapshots
USER app
VOLUME ["/app/data"]
EXPOSE 3000
ENTRYPOINT ["sh", "docker-entrypoint.sh"]
CMD ["node", "server.js"]

FROM node:24-alpine AS bridge
WORKDIR /app
COPY ai-engine/yolo_bridge.js ./
RUN npm init -y >/dev/null && npm install --omit=dev express@5.2.1 socket.io@4.8.3 dotenv@17.4.2 && npm cache clean --force
USER node
EXPOSE 4001
CMD ["node", "yolo_bridge.js"]
