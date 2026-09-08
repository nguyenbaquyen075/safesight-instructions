## Tóm tắt
- Hệ thống chạy được trên **PostgreSQL** bên cạnh SQLite: adapter được chọn theo lược đồ của `DATABASE_URL`, thêm `prisma/postgres/schema.prisma` (bản sao schema, chỉ khác `provider`), script chuyển đổi dữ liệu, và service `postgres` tuỳ chọn trong `docker-compose.yml` dưới profile `pg`.
- Chạy được **nhiều worker agent**: `rememberCamera()` không còn đè mất ghi chú khi hai worker ghi cùng lúc; mỗi phiên ghi `workerId` vào `session.started`; rate limit được ghi rõ là per-worker.
- Ngăn xếp mặc định **không đổi**: không bật profile `pg` thì mọi thứ vẫn là SQLite y như trước.

## Issue
Closes #<n>

## Thay đổi chính
- `prisma/postgres/schema.prisma` (mới): bản sao nguyên văn của `prisma/schema.prisma`, chỉ khác `provider = "postgresql"`. Cố ý **không** khôi phục enum/mảng native — giữ `String` + JSON-trong-`String` nên kiểu TypeScript sinh ra giống hệt bản SQLite và mã nguồn không phải rẽ nhánh theo DB. `agent/test/schema-parity.test.ts` so hai file sau khi bỏ chú thích/dòng trống và chuẩn hoá dòng `provider`.
- `src/lib/prisma.ts`: tách `createAdapter(url)` — `postgres://`/`postgresql://` → `new PrismaPg({ connectionString })`, còn lại → `PrismaLibSqlWal` (giữ nguyên hai PRAGMA WAL/busy_timeout). Không thêm biến cấu hình riêng: một `DATABASE_URL` quyết định tất cả. `prisma/seed.mjs` làm y hệt (bản JS vì seed chạy bằng `node`).
- `agent/lib/camera-agent.ts` `rememberCamera()`: `update` → `updateMany({ where: { id, memory: <bản vừa đọc> } })`; `count === 0` (worker khác chen vào) thì đọc lại và thử lần hai, hết hai lần thì ném lỗi thay vì âm thầm mất ghi chú.
  **Lệch có chủ ý so với kế hoạch**, kế hoạch ghi so theo `updatedAt`: `updatedAt` của SQLite chỉ tới mili-giây nên hai lượt ghi trong cùng 1ms **không phát hiện được xung đột** (âm tính giả), và `addCameraTokens()` cũng bump `updatedAt` liên tục nên sinh **xung đột giả** (dương tính giả). So thẳng giá trị đang sửa là compare-and-swap đúng nghĩa, không có cả hai lỗi trên.
- `agent/lib/env.ts`: `workerId = AGENT_WORKER_ID ?? <hostname>-<pid>`; `agent/session.ts` ghi `workerId` vào `data` của `session.started`.
- `agent/lib/guard.ts`: ghi rõ `LIMITS`/`rateLimit()` đếm **trong bộ nhớ một tiến trình** → trần theo hệ thống là N lần khi chạy N worker; các trần theo phiên không bị ảnh hưởng. `agent/lib/tasks.ts`: sửa lại chú thích `claimDue()` — lease bằng `updateMany` có điều kiện vốn đã **đúng** với nhiều worker (không cần `FOR UPDATE SKIP LOCKED`, cái đó chỉ là tối ưu thông lượng).
- `scripts/sqlite-to-postgres.mjs` (mới) + `npm run db:pg:migrate-data`: đọc SQLite bằng Prisma Client mặc định, ghi Postgres bằng `pg` thô (`INSERT ... ON CONFLICT DO NOTHING`, lô 500 dòng, 16 bảng theo đúng thứ tự khoá ngoại). Chạy lại được, không nhân đôi. Không thêm dependency: `pg` đã có sẵn.
- `package.json`: `db:pg:push`, `db:pg:generate`, `db:pg:migrate-data`.
- `docker-compose.yml`: service `postgres:16-alpine` với `profiles: ["pg"]`, volume `pgdata`, healthcheck `pg_isready`, chỉ mở `127.0.0.1:5432` (AI engine/agent chạy ngoài container vẫn nối được). `DATABASE_URL` của dashboard đổi thành `${DATABASE_URL:-file:./data/dev.db}` nên mặc định không đổi hành vi. `Dockerfile`: build arg `PRISMA_SCHEMA` + `BUILD_DATABASE_URL`, bước seed SQLite chỉ chạy cho bản SQLite. `docker-entrypoint.sh`: `DATABASE_URL` là Postgres thì bỏ qua toàn bộ phần khởi tạo file SQLite.

## Kiểm thử
- [x] `npm run test:agent` — **151/151 pass** (147 cũ + 4 mới: `agent/test/schema-parity.test.ts` 2, `agent/test/db-pragma.test.ts` +1 chọn adapter, `agent/test/camera-agent.test.ts` +1 hai worker ghi song song)
- [x] `npx tsc --noEmit` · `npx eslint .` — sạch
- [x] `node --check scripts/sqlite-to-postgres.mjs`; `docker-compose.yml` parse được bằng `yaml.safe_load`
- [ ] Python — không đụng `ai-engine/`
- [ ] Kiểm tra hình ảnh desktop/mobile — **không áp dụng**: PR này không đổi giao diện.
- [ ] **PostgreSQL thật — CHƯA NGHIỆM THU.** Máy phát triển không có Postgres và đợt này không được chạy container. Xem mục "Rủi ro" bên dưới.

## Tài liệu
- `wiki/03-cai-dat-va-van-hanh.md`: mục mới "Chuyển sang PostgreSQL" (4 bước có lệnh cụ thể + phần Docker), mục "Nhiều worker agent", 3 dòng lệnh npm mới.
- `wiki/04-mo-hinh-du-lieu.md`: viết lại mục "Dev SQLite ↔ Production PostgreSQL" — bảng hai schema, cách chọn adapter, ràng buộc query compiler của Prisma 7.
- `wiki/09-agent.md`: mục "Nhiều worker" (điều kiện, chỗ đã an toàn, chỗ chưa chia sẻ giữa worker), biến `AGENT_WORKER_ID`, sửa lại đoạn mô tả `claimDue()`.
- `README.md` (mục Docker): đoạn PostgreSQL tuỳ chọn. `.env.docker.example`: khối "Cơ sở dữ liệu" + `AGENT_WORKER_ID`.
- `docs/ba/14-nfr.md`: NFR-20 🔲 → 🟡 (đường chuyển đổi đã có, chưa nghiệm thu, backup vẫn chưa viết). `CHANGELOG.md`: Unreleased → Thêm / Thay đổi.

## Rủi ro và việc còn lại
- **Chưa chạy một câu lệnh nào trên PostgreSQL thật.** `db:pg:push`, `sqlite-to-postgres.mjs` và nhánh `PrismaPg` mới chỉ được kiểm bằng đọc lại mã, `node --check` và test SQLite. Cần một môi trường có Postgres để nghiệm thu trước khi tin dùng ở production.
- **Prisma 7 chỉ cho một client mỗi lần generate**: query compiler được nhúng theo `provider` của schema (client sinh từ schema sqlite mang `activeProvider: "sqlite"` và bản wasm sqlite), nên **không thể** dùng chung một client cho cả hai DB. Hệ quả: `npm run db:pg:generate` **thay** client SQLite trong `node_modules` (quay lại dev thì chạy `npx prisma generate`), và script chép dữ liệu bắt buộc phải chạy **trước** bước generate. Cố ý không sinh client thứ hai ra `output` riêng + import động: sẽ phải rẽ nhánh import ở mọi chỗ dùng Prisma và làm `tsc` phụ thuộc vào một thư mục chưa chắc tồn tại.
- Script chép dữ liệu đọc theo `skip`/`take` với `orderBy: id` — phải chạy khi hệ thống **dừng ghi**, chép nóng có thể sót dòng.
- `rememberCamera()` ném lỗi khi trượt hai lần liên tiếp. Với nhịp thực tế (≤ 3 ghi chú/phiên) chuyện này gần như không xảy ra; nếu về sau ghi dày hơn thì đổi thành vòng lặp có backoff (đã ghi `ponytail:` tại chỗ).
- `rateLimit()` và `claudeLatchedOff()` vẫn **theo tiến trình**: chạy N worker thì trần `engineRestartPerHour`/`cameraStatusPerCamera5m` là N lần con số cấu hình. Muốn trần đúng theo hệ thống phải đếm trong DB — task riêng.
- `ensureRecurring()` do mọi worker cùng gieo; hàm gộp theo `(kind, subject)` nên không nhân đôi task, nhưng log sẽ ồn hơn.
- Chưa có quy trình backup cho PostgreSQL (NFR-20 vẫn 🟡).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
