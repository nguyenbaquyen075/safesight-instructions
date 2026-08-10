# Cảnh báo vi phạm qua Telegram — Design

Date: 2026-08-10
Status: Approved by user, ready for implementation plan

## Problem

Vi phạm PPE hiện chỉ hiển thị trên dashboard (`/violations`, `/cameras`) — người quản lý phải đang mở app mới biết. Cần gửi cảnh báo chủ động qua Telegram tới người phụ trách khi có vi phạm mới, để không phải túc trực màn hình.

Ý tưởng gốc lấy từ `huong-dan-telegram-notification.md` (Flask/SQLAlchemy) nhưng project này là Next.js/TypeScript + Prisma, với pipeline detection Python (`ai-engine/yolo_inference.py`) gọi `POST /api/violations` để ghi vi phạm thật vào DB. Spec này viết lại theo đúng stack và schema đã có của project, không copy nguyên kiến trúc bên Python.

## Scope

In scope:
- Gửi tin nhắn Telegram (kèm ảnh snapshot vi phạm) tới danh sách chat_id cấu hình sẵn, ngay khi có vi phạm mới khớp điều kiện.
- Quản lý quy tắc cảnh báo theo site (loại vi phạm nào, gửi qua kênh nào, gửi cho ai, ngưỡng, cooldown) — CRUD thật đầu tiên cho `AlertRule` trong project (hiện chưa route nào dùng DB thật cho nó).
- Cấu hình bot token Telegram qua UI Settings, mã hoá trước khi lưu DB.
- Phân quyền: chỉ `SUPER_ADMIN`/`ORG_ADMIN` hoặc user có site trong `assignedSites` mới sửa/xoá được rule của site đó.

Out of scope (mặc định bỏ, nói rõ nếu cần sau):
- Tự động lấy chat_id qua webhook (`setWebhook`) — cần domain HTTPS công khai, không chạy được trên localhost dev. Chat_id lấy tay qua `@userinfobot`/`getUpdates`.
- Đa bot theo org/site — chỉ 1 bot Telegram dùng chung toàn hệ thống (1 dòng `TelegramSettings`).
- Field `recipient_type` (user/group) trong DB — không phục vụ logic nào (Telegram API xử lý chat_id user/group giống nhau), chỉ là hướng dẫn text trong UI.
- Đếm dồn vi phạm theo `threshold > 1` là tính năng có sẵn trong schema nhưng **không phải hành vi mặc định** — mặc định `threshold = 1`, báo ngay vi phạm đầu tiên.
- Retry/backoff nhiều tầng, hàng đợi (Celery/queue) — chỉ 1 lần retry đơn giản trong `TelegramClient`.

## Architecture

```
yolo_inference.py (Python, đồng bộ, chặn frame loop)
        |  session.post() -- BẮT BUỘC nhanh, không được đợi Telegram
        v
POST /api/violations  (Next.js)
        |
        |-- prisma.violation.create(...)
        |-- notifyViolation(violation, camera)   <-- KHÔNG await, fire-and-forget + .catch
        |-- return 201 ngay
        v
alert-notifier.ts: notifyViolation()
        |
        |-- đọc TelegramSettings (isEnabled? có botToken?)
        |-- tìm AlertRule khớp site + violationType + channels chứa 'telegram' + isActive
        |-- threshold: bỏ qua đếm nếu threshold<=1 (mặc định); nếu >1, đếm Violation
        |     cùng site/loại trong cooldownSec gần nhất, đủ mới bắn
        |-- cooldown: query Alert gần nhất của rule, còn trong cooldownSec thì bỏ qua
        v
telegram.ts: TelegramClient.sendPhoto() cho từng chat_id trong rule.recipients
        |
        '-- ghi Alert (channel='telegram', recipient=chat_id, status, error_message)
```

Điểm mấu chốt: server chạy dạng process dài hạn (`dev-all.sh`), không phải serverless — nên fire-and-forget promise chạy xong bình thường ở background sau khi response đã trả về. Nếu sau này đổi sang serverless (Vercel functions), chỗ này cần đổi sang `waitUntil`/queue — đánh dấu bằng `ponytail:` comment tại điểm gọi.

## Data model

### Thêm mới (chỉ 1 bảng)

```prisma
model TelegramSettings {
  id               String   @id @default(cuid())
  botTokenEncrypted String?
  isEnabled        Boolean  @default(false)
  updatedAt        DateTime @updatedAt
  createdAt        DateTime @default(now())
}
```
Chỉ nên có 1 dòng — service layer luôn `findFirst()` rồi tạo mới nếu chưa có, giống cách `AlertRule`/`Violation` khác đang query.

### Tái dùng (không đổi schema)

- `AlertRule.channels` (String, JSON array) — thêm giá trị `'telegram'` khi tạo/sửa rule. Không dùng Prisma `has:`/`array_contains` (cột là `String` thuần, không phải native array hay `Json` type) — filter bằng `JSON.parse(rule.channels).includes('telegram')` ở tầng app sau khi `findMany` theo `siteId + isActive`.
- `AlertRule.recipients` (String, JSON array) — danh sách chat_id Telegram dạng string.
- `AlertRule.threshold` — mặc định `1` khi tạo rule mới qua UI.
- `AlertRule.cooldownSec` — vừa là cooldown sau khi bắn, vừa là cửa sổ đếm cho `threshold` khi threshold > 1 (dùng chung 1 field, có comment giải thích rõ trong code — xem Components).
- `Alert` — 1 dòng log mỗi lần gửi tới 1 recipient (`channel='telegram'`, `recipient=chat_id`, `status`, `error_message`, `sentAt`).

### Sửa

- `AlertChannel` enum (`src/types/enums.ts`): thêm `TELEGRAM = 'telegram'`.

## Components

### 1. `src/lib/crypto.ts` (mới)

- `encrypt(text: string): string` / `decrypt(encrypted: string): string` dùng `node:crypto` AES-256-GCM. Không thêm dependency — Node có sẵn.
- Key từ `process.env.TELEGRAM_ENCRYPT_KEY` (32 byte, tạo 1 lần, để trong `.env.local`, **không commit**) — đúng pattern `AI_ENGINE_SECRET`/`NEXTAUTH_SECRET` đã dùng.

### 2. `src/lib/telegram.ts` (mới)

```ts
class TelegramClient {
  constructor(private botToken: string) {}
  async getMe(): Promise<...>
  async sendMessage(chatId: string, text: string): Promise<...>
  async sendPhoto(chatId: string, snapshotPath: string, caption: string): Promise<...>
}
```
- Dùng `fetch` built-in, không thêm `axios`/`node-fetch`.
- `sendPhoto` đọc file bằng `fs.readFile('public' + snapshotUrl)`, upload multipart qua `FormData`/`Blob` global của Node — không phụ thuộc `snapshotUrl` phải public-reachable (chạy đúng cả trên localhost dev).
- 1 lần retry khi lỗi mạng hoặc Telegram trả `ok:false`, không có backoff nhiều tầng.

### 3. `src/lib/alert-notifier.ts` (mới)

`notifyViolation(violation: Violation, camera: Camera): Promise<void>`

Chỉ nhận `camera` (đã có sẵn ở nơi gọi từ `prisma.camera.findUnique` trong `violations/route.ts`, có `siteId` + `name`) — không fetch thêm `Site` vì không cần dữ liệu nào khác của site ngoài `siteId`.

1. `TelegramSettings.findFirst()` — `!isEnabled || !botTokenEncrypted` → return.
2. `AlertRule.findMany({ where: { siteId: camera.siteId, isActive: true } })`, lọc JS: `channels` (parse JSON) chứa `'telegram'` và (`violationTypes` rỗng hoặc chứa `violation.type`).
3. Với mỗi rule:
   - Nếu `rule.threshold > 1`: đếm `Violation` cùng `siteId`+`type` tạo trong `cooldownSec` gần nhất (`prisma.violation.count`); chưa đủ thì bỏ qua rule này.
   - Cooldown: `Alert.findFirst({ where: { ruleId: rule.id }, orderBy: { sentAt: 'desc' } })` — còn trong `cooldownSec` thì bỏ qua.
   - Với mỗi `chatId` trong `rule.recipients`: `sendPhoto(...)`, ghi `Alert` (`success`/`failed`). Lỗi 1 recipient không chặn recipient khác (catch riêng từng cái).

### 4. Hook vào `src/app/api/violations/route.ts`

Ngay sau `prisma.violation.create(...)`:
```ts
// ponytail: fire-and-forget vì server chạy long-lived process (dev-all.sh);
// nếu chuyển sang serverless phải đổi sang waitUntil/queue
notifyViolation(violation, camera, site).catch(err => console.error('[telegram] notify failed', err));
```
Không `await` — `session.post()` bên `yolo_inference.py` đang chặn vòng lặp frame chính, không được làm chậm response.

### 5. API routes (mới)

- `GET /api/settings/telegram` → `{ isEnabled, hasToken }` (không bao giờ trả token thật).
- `POST /api/settings/telegram` → body `{ botToken?: string, isEnabled?: boolean }`. `botToken` rỗng/absent → giữ nguyên token cũ (chỉ update field khác). Có giá trị → mã hoá rồi ghi đè.
- `POST /api/settings/telegram/test` → body `{ botToken?: string }`. Có `botToken` → test trực tiếp (chưa lưu). Không có → giải mã token đã lưu trong DB rồi test. Trả kết quả `getMe` hoặc lỗi.
- `GET /api/alert-rules?siteId=` → danh sách rule.
- `POST /api/alert-rules` → tạo rule mới. Zod validate (xem Validation).
- `PATCH /api/alert-rules/[id]` / `DELETE /api/alert-rules/[id]` → yêu cầu `auth()`; `SUPER_ADMIN`/`ORG_ADMIN` qua thẳng; role khác phải có `rule.siteId` nằm trong `User.assignedSites` (query riêng bằng `session.user.id`, không đụng `src/auth.ts`/session callback hiện tại) — sai quyền trả 403, sai id trả 404.

### 6. Validation (zod, dùng chung schema client + server)

```ts
const chatIdSchema = z.string().regex(/^-?\d+$/, 'chat_id không hợp lệ');

const alertRuleSchema = z.object({
  siteId: z.string(),
  name: z.string().min(1),
  violationTypes: z.array(z.string()),
  channels: z.array(z.nativeEnum(AlertChannel)),
  recipients: z.array(chatIdSchema),
  threshold: z.number().int().min(1),
  cooldownSec: z.number().int().min(0),
  isActive: z.boolean(),
}).superRefine((data, ctx) => {
  if (data.channels.includes(AlertChannel.TELEGRAM) && data.recipients.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['recipients'], message: 'Cần ít nhất 1 người nhận khi bật kênh Telegram' });
  }
});
```

### 7. Frontend

- Mở rộng tab "Thông báo" có sẵn ở `src/app/(dashboard)/settings/page.tsx` (hiện chỉ là switch tĩnh không nối backend):
  - Khối "Bot Telegram": input token (password + icon mắt, placeholder "Đã cấu hình" khi `hasToken=true`, để trống khi submit = giữ nguyên), nút "Kiểm tra kết nối" (gọi API test với token đang gõ nếu có), switch bật/tắt tổng (`TelegramSettings.isEnabled`).
  - Khối "Quy tắc cảnh báo": bảng rule theo site + nút "Thêm quy tắc" mở dialog.
- `src/components/settings/AlertRuleEditDialog.tsx` (mới, theo pattern `src/components/users/UserEditDialog.tsx` đã có): chọn site, multi-select `ViolationType`, multi-select `AlertChannel` (gồm Telegram), input thêm/xoá chat_id (validate regex ngay client), threshold (mặc định 1), cooldownSec (giây), toggle active.
- Text hướng dẫn ngắn trong dialog: cá nhân dùng `@userinfobot` hoặc `/start` bot rồi gọi `getUpdates`; nhóm phải add bot vào group trước, `getUpdates` mới ra id âm (`@userinfobot` không dùng được cho group).

## Error handling

- Lỗi Telegram (mạng, token sai, chat không tồn tại) không bao giờ throw ra khỏi `notifyViolation` — catch từng recipient, ghi `Alert.status='failed'`, tiếp tục recipient khác.
- `POST /api/violations` luôn trả 201 ngay sau khi ghi DB xong, bất kể `notifyViolation` thành công hay lỗi.
- API Settings/AlertRule: lỗi zod → 400 kèm chi tiết field; thiếu quyền → 403; không tìm thấy → 404 — theo đúng pattern `violations/route.ts`.
- Token sai khi bấm "Kiểm tra kết nối" → hiện `description` lỗi thật từ Telegram API, không crash UI.

## Testing

Không có test framework tự động cho API routes trong repo hiện tại — theo pattern hiện có (`violations/route.ts` cũng không có test tự động). Kiểm tra thủ công:

- `getMe` đúng khi token đúng / báo lỗi rõ khi token sai — cả token chưa lưu (qua nút test) lẫn token đã lưu trong DB.
- Rule có `channels` chứa `telegram` nhưng `recipients` rỗng → bị chặn ngay lúc lưu (400), không tạo được rule "câm".
- Vi phạm giả lập khớp 1 rule đang active, threshold=1 → tất cả recipient của rule nhận tin kèm ảnh ngay lập tức.
- 2 vi phạm cùng loại/camera cách nhau < `cooldownSec` → chỉ gửi 1 lần; sau khi hết cooldown → gửi tiếp cho vi phạm mới.
- Rule `isActive=false` hoặc `siteId` không khớp → không gửi.
- `TelegramSettings.isEnabled=false` → tắt hoàn toàn, không rule nào gửi được dù có vi phạm.
- User không có site trong `assignedSites` cố `PATCH`/`DELETE` rule của site đó → 403; `SUPER_ADMIN`/`ORG_ADMIN` luôn qua được.
- Token trong DB ở dạng mã hoá (check trực tiếp trong SQLite) — không API response nào trả token thật.
- Đo thời gian phản hồi `POST /api/violations` khi Telegram lỗi/timeout → vẫn nhanh (không bị chặn bởi lỗi Telegram).
