# PostgreSQL và chạy nhiều worker agent

## Vấn đề
Toàn hệ thống đang khoá cứng vào SQLite: `src/lib/prisma.ts` luôn dựng `PrismaLibSqlWal`,
`prisma/seed.mjs` luôn dựng `PrismaLibSql`, chỉ có một `prisma/schema.prisma` với
`provider = "sqlite"`. `@prisma/adapter-pg` và `pg` đã nằm trong `package.json` từ lâu
nhưng **không có đường nào chạy tới**.

SQLite chỉ cho **một tiến trình ghi tại một thời điểm**. Hệ quả thực tế:
- Không chạy được nhiều worker agent, cũng không chạy được nhiều bản dashboard sau load
  balancer — trần thông lượng là một máy.
- `rememberCamera()` đọc `CameraAgent.memory` (JSON), thêm một ghi chú rồi **ghi đè cả
  chuỗi**. Hai phiên của cùng một camera chạy song song ở hai worker sẽ đọc cùng một bản
  rồi ghi đè nhau: **mất ghi chú, không có lỗi nào được báo**.
- Đọc `AgentEvent` không biết phiên nào chạy ở tiến trình nào.
- `LIMITS`/`rateLimit()` trong `agent/lib/guard.ts` đếm trong bộ nhớ tiến trình mà tài
  liệu không nói rõ, dễ hiểu nhầm là trần của cả hệ thống.

## Đề xuất
- Thêm `prisma/postgres/schema.prisma`: **bản sao** của schema SQLite, chỉ khác dòng
  `provider`. Cố ý giữ `String` + JSON-trong-`String` thay vì khôi phục enum/mảng native
  để kiểu TypeScript sinh ra giống hệt nhau, mã nguồn không phải rẽ nhánh theo DB.
- `src/lib/prisma.ts` và `prisma/seed.mjs` chọn adapter theo **lược đồ của `DATABASE_URL`**
  (`postgres://`/`postgresql://` → `PrismaPg`, `file:` → `PrismaLibSqlWal`), không thêm
  biến cấu hình nào để quên đồng bộ.
- Script `db:pg:push`, `db:pg:generate` và `scripts/sqlite-to-postgres.mjs` chép dữ liệu
  theo đúng thứ tự khoá ngoại; tài liệu ghi rõ thứ tự chạy (chép dữ liệu **trước** khi đổi
  Prisma Client, vì Prisma 7 nhúng query compiler theo provider lúc generate).
- `docker-compose.yml`: service `postgres:16-alpine` dưới profile `pg` (volume `pgdata`),
  `DATABASE_URL` của dashboard đọc từ `.env`, build arg chọn schema cho image.
- `rememberCamera()` chuyển sang cập nhật có điều kiện (optimistic): chỉ ghi khi `memory`
  trong DB vẫn đúng bản vừa đọc, trượt thì đọc lại và thử lại một lần.
- `AGENT_WORKER_ID` (mặc định `<hostname>-<pid>`) ghi vào `session.started`; nói rõ trong
  `guard.ts` và `wiki/09` rằng rate limit là **per-worker**.

## Tiêu chí nghiệm thu
- [ ] Hai file schema chỉ khác dòng `provider`, có test tự động canh (sửa một file mà quên
      file kia → test đỏ).
- [ ] `createAdapter()` chọn `PrismaPg` cho URL Postgres và `PrismaLibSqlWal` (bản có
      PRAGMA WAL) cho `file:`, có test — không mở kết nối thật.
- [ ] Hai lời gọi `rememberCamera()` song song trên cùng một camera giữ được **cả hai**
      ghi chú, có test.
- [ ] `session.started` mang `workerId`.
- [ ] Ngăn xếp Docker mặc định (không bật profile) vẫn chạy SQLite **y như trước**:
      không service mới nào được kéo lên, `DATABASE_URL` mặc định không đổi.
- [ ] Toàn bộ test SQLite hiện có vẫn xanh; `npx tsc --noEmit`, `npx eslint .` sạch.
- [ ] Tài liệu cùng commit: `wiki/03` (quy trình chuyển đổi + lệnh npm), `wiki/04` (hai
      schema, chọn adapter), `wiki/09` (mục "Nhiều worker"), README (Docker),
      `.env.docker.example`, `docs/ba/14` NFR-20, `CHANGELOG.md`.
- [ ] PR ghi rõ: **chưa nghiệm thu trên PostgreSQL thật**, cần môi trường có Postgres.
