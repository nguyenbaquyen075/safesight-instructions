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
ENV NEXT_TELEMETRY_DISABLED=1 DATABASE_URL=file:./data/dev.db
COPY . .
RUN npx prisma generate \
 && npm run build \
 && mkdir -p data && npx prisma db push && npm run db:seed

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
