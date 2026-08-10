# Telegram Violation Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gửi cảnh báo Telegram (kèm ảnh snapshot) tới danh sách chat_id cấu hình theo `AlertRule`, ngay khi có vi phạm PPE mới ghi vào DB, không làm chậm pipeline detection Python.

**Architecture:** `POST /api/violations` (Next.js) gọi `notifyViolation()` fire-and-forget ngay sau khi ghi `Violation` vào DB. `notifyViolation()` tra `TelegramSettings` (bật/tắt + token mã hoá), tìm `AlertRule` khớp site/loại vi phạm/kênh `telegram`, áp dụng threshold + cooldown, rồi gửi qua `TelegramClient` và ghi log vào `Alert`. UI CRUD cho `AlertRule` + cấu hình bot token nằm trong tab "Thông báo" của trang Settings.

**Tech Stack:** Next.js 16 (App Router) + TypeScript, Prisma 7 (SQLite dev), Zod, `@tanstack/react-query`, `@radix-ui/react-dialog`, Node built-in `crypto`/`fetch`/`FormData`/`fs`. Không thêm dependency mới.

Spec gốc: `docs/superpowers/specs/2026-08-10-telegram-notification-design.md`

## Global Constraints

- **Không thêm dependency mới.** Mã hoá dùng `node:crypto` built-in; gọi Telegram API dùng `fetch`/`FormData`/`Blob` global của Node — không dùng `axios`/`node-fetch`/`form-data`.
- **Không có framework test tự động trong repo** (đã kiểm tra: không có `jest`/`vitest` trong `devDependencies`, không có file `*.test.ts*` nào). Mỗi task dưới đây thay bước "viết test tự động" bằng: `npx tsc --noEmit` (typecheck) + verify thủ công bằng `curl`/`sqlite3`/thao tác UI — đúng convention đã ghi trong `docs/superpowers/specs/2026-08-05-voice-alert-design.md`.
- **Cột JSON-in-String** (`AlertRule.channels`, `violationTypes`, `recipients`) — SQLite ở đây không có native array/Json type. Luôn `JSON.parse(...)`/`JSON.stringify(...)` ở tầng app, không dùng Prisma `has:`/`array_contains`.
- **Giá trị enum-backed String** ghi thẳng bằng giá trị lowercase của TS enum (vd `'telegram'`, `'hard_hat'`) — khớp cách `violations/route.ts` đang ghi `type`/`severity`. Field có `@default("UPPERCASE")` như `Alert.status`/`Violation.status` thì **không set** khi tạo, để DB tự áp default, giống cách `Violation.create()` hiện tại không set `status`.
- **Secret** (`TELEGRAM_ENCRYPT_KEY`, bot token) chỉ trong `.env.local` (đã gitignore) — không bao giờ log, không bao giờ trả về trong response API.
- **Dữ liệu seed có sẵn để test thủ công:** site `site-001`, camera `cam-001` (thuộc `site-001`). `AI_ENGINE_SECRET` đã có trong `.env.local`.

---

### Task 1: Prisma schema — `TelegramSettings`, `Alert.errorMessage`, enum `TELEGRAM`

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/types/enums.ts`

**Interfaces:**
- Produces: model `TelegramSettings { id, botTokenEncrypted, isEnabled, createdAt, updatedAt }`; field `Alert.errorMessage: String?`; `AlertChannel.TELEGRAM = 'telegram'`.

- [ ] **Step 1: Thêm model `TelegramSettings` vào `prisma/schema.prisma`**

Thêm vào cuối file (sau model `AuditLog`):

```prisma
model TelegramSettings {
  id                String   @id @default(cuid())
  botTokenEncrypted String?
  isEnabled         Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

- [ ] **Step 2: Thêm `errorMessage` vào model `Alert`**

Trong `model Alert`, thêm dòng `errorMessage String?` ngay sau `status`:

```prisma
model Alert {
  id               String   @id @default(cuid())
  violationId      String
  ruleId          String?
  channel         String
  recipient       String
  status          String   @default("NEW")
  errorMessage    String?
  sentAt          DateTime @default(now())
  acknowledgedById String?
  acknowledgedAt  DateTime?
  escalatedAt     DateTime?
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  violation      Violation  @relation(fields: [violationId], references: [id], onDelete: Cascade)
  alertRule     AlertRule? @relation(fields: [ruleId], references: [id], onDelete: SetNull)
  acknowledgedBy User?     @relation(fields: [acknowledgedById], references: [id], onDelete: SetNull)
}
```

- [ ] **Step 3: Thêm `TELEGRAM` vào enum `AlertChannel`**

Trong `src/types/enums.ts`:

```ts
export enum AlertChannel {
  IN_APP = 'in_app',
  SMS = 'sms',
  EMAIL = 'email',
  SIREN = 'siren',
  PA_SYSTEM = 'pa_system',
  WEBHOOK = 'webhook',
  TELEGRAM = 'telegram',
}
```

- [ ] **Step 4: Push schema vào DB dev local + generate client**

Run:
```bash
cd "/Users/admin/Documents/Safesight Instruction/safesight-instructions"
npx prisma db push
npx prisma generate
```
Expected: output báo `TelegramSettings` table mới được tạo, cột `errorMessage` thêm vào `Alert`, không báo lỗi mất dữ liệu (đây là thêm bảng/cột mới, không xoá gì).

- [ ] **Step 5: Verify bằng sqlite3 CLI**

Run: `sqlite3 prisma/dev.db ".schema TelegramSettings" ".schema Alert"`
Expected: thấy cột `botTokenEncrypted`, `isEnabled` trong `TelegramSettings`; thấy cột `errorMessage` trong `Alert`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/types/enums.ts
git commit -m "feat(db): add TelegramSettings model, Alert.errorMessage, AlertChannel.TELEGRAM"
```

---

### Task 2: Mã hoá bot token — `src/lib/crypto.ts`

**Files:**
- Create: `src/lib/crypto.ts`

**Interfaces:**
- Produces: `encrypt(plaintext: string): string`, `decrypt(encoded: string): string`.

- [ ] **Step 1: Viết `src/lib/crypto.ts`**

```ts
// SPDX-License-Identifier: MIT

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const key = process.env.TELEGRAM_ENCRYPT_KEY;
  if (!key) throw new Error('TELEGRAM_ENCRYPT_KEY is not set');
  const buf = Buffer.from(key, 'base64');
  if (buf.length !== 32) throw new Error('TELEGRAM_ENCRYPT_KEY must decode to 32 bytes');
  return buf;
}

// Format: <iv:base64>.<authTag:base64>.<ciphertext:base64>
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${ciphertext.toString('base64')}`;
}

export function decrypt(encoded: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encoded.split('.');
  if (!ivB64 || !authTagB64 || !ciphertextB64) throw new Error('Invalid encrypted token format');
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
```

- [ ] **Step 2: Tạo `TELEGRAM_ENCRYPT_KEY` và thêm vào `.env.local`**

Run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
Copy kết quả, thêm dòng vào `.env.local` (KHÔNG commit file này — đã có trong `.gitignore`):
```
TELEGRAM_ENCRYPT_KEY=<kết quả copy ở trên>
```

- [ ] **Step 3: Verify round-trip bằng node trực tiếp (Node ≥22 tự strip type TS, không cần build)**

Run (thay `<key>` bằng giá trị vừa tạo, hoặc để trống dùng key tạm):
```bash
TELEGRAM_ENCRYPT_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))") \
node -e "
const { encrypt, decrypt } = require('./src/lib/crypto.ts');
const enc = encrypt('123456:ABC-test-token');
console.log('encrypted:', enc);
console.log('decrypted:', decrypt(enc));
"
```
Expected: dòng `decrypted:` in ra đúng `123456:ABC-test-token`. Nếu Node không cho `require()` file `.ts` trực tiếp trên máy đang chạy, dùng: `node --input-type=module -e "import('./src/lib/crypto.ts').then(m => { const e = m.encrypt('123456:ABC-test-token'); console.log(m.decrypt(e)); })"`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/crypto.ts
git commit -m "feat(telegram): add AES-256-GCM token encryption helper"
```

---

### Task 3: Telegram API client — `src/lib/telegram.ts`

**Files:**
- Create: `src/lib/telegram.ts`

**Interfaces:**
- Consumes: none (chỉ cần bot token string).
- Produces: `class TelegramClient { constructor(botToken: string); getMe(): Promise<TelegramResult>; sendMessage(chatId: string, text: string): Promise<TelegramResult>; sendPhoto(chatId: string, snapshotUrl: string, caption: string): Promise<TelegramResult>; }`, `interface TelegramResult { ok: boolean; description?: string; result?: unknown }`.

- [ ] **Step 1: Viết `src/lib/telegram.ts`**

```ts
// SPDX-License-Identifier: MIT

import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface TelegramResult {
  ok: boolean;
  description?: string;
  result?: unknown;
}

const BASE_URL = 'https://api.telegram.org';

async function callTelegram(botToken: string, method: string, init: RequestInit): Promise<TelegramResult> {
  let lastError = 'unknown error';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/bot${botToken}/${method}`, init);
      const data = (await res.json()) as TelegramResult;
      if (!data.ok) {
        lastError = data.description || 'Telegram API trả lỗi không rõ';
        continue;
      }
      return data;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { ok: false, description: lastError };
}

export class TelegramClient {
  constructor(private botToken: string) {}

  getMe(): Promise<TelegramResult> {
    return callTelegram(this.botToken, 'getMe', { method: 'GET' });
  }

  sendMessage(chatId: string, text: string): Promise<TelegramResult> {
    return callTelegram(this.botToken, 'sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  }

  async sendPhoto(chatId: string, snapshotUrl: string, caption: string): Promise<TelegramResult> {
    const filePath = path.join(process.cwd(), 'public', snapshotUrl.replace(/^\//, ''));
    const fileBuffer = await readFile(filePath);
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');
    form.append('photo', new Blob([fileBuffer]), path.basename(filePath));
    return callTelegram(this.botToken, 'sendPhoto', { method: 'POST', body: form });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: không lỗi liên quan `src/lib/telegram.ts`.

- [ ] **Step 3: Verify thủ công (tuỳ chọn, cần bot token thật)**

Nếu anh đã có bot token thật từ @BotFather, verify nhanh:
```bash
curl "https://api.telegram.org/bot<TOKEN>/getMe"
```
Expected: JSON có `"ok":true`. Việc này xác nhận token hợp lệ trước khi test `TelegramClient` qua UI ở Task 14 — không bắt buộc phải làm ngay ở task này.

- [ ] **Step 4: Commit**

```bash
git add src/lib/telegram.ts
git commit -m "feat(telegram): add TelegramClient (getMe/sendMessage/sendPhoto)"
```

---

### Task 4: Zod validation dùng chung — `src/lib/validation/alert-rule.ts`

**Files:**
- Create: `src/lib/validation/alert-rule.ts`

**Interfaces:**
- Produces: `chatIdSchema: ZodString`, `alertRuleObjectSchema: ZodObject` (chưa refine, dùng cho `.partial()` ở PATCH), `alertRuleSchema: ZodEffects` (có superRefine, dùng cho POST/tạo mới và validate bản merge ở PATCH), `type AlertRuleInput = z.infer<typeof alertRuleSchema>`.

- [ ] **Step 1: Viết `src/lib/validation/alert-rule.ts`**

```ts
// SPDX-License-Identifier: MIT

import { z } from 'zod';
import { AlertChannel } from '@/types/enums';

export const chatIdSchema = z
  .string()
  .regex(/^-?\d+$/, 'chat_id không hợp lệ (chỉ gồm số, có thể có dấu - ở đầu cho group)');

export const alertRuleObjectSchema = z.object({
  siteId: z.string().min(1),
  name: z.string().min(1),
  violationTypes: z.array(z.string()),
  channels: z.array(z.nativeEnum(AlertChannel)),
  recipients: z.array(chatIdSchema),
  threshold: z.number().int().min(1),
  cooldownSec: z.number().int().min(0),
  isActive: z.boolean(),
});

export const alertRuleSchema = alertRuleObjectSchema.superRefine((data, ctx) => {
  if (data.channels.includes(AlertChannel.TELEGRAM) && data.recipients.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['recipients'],
      message: 'Cần ít nhất 1 người nhận khi bật kênh Telegram',
    });
  }
});

export type AlertRuleInput = z.infer<typeof alertRuleSchema>;
```

- [ ] **Step 2: Verify thủ công bằng node**

Run:
```bash
node --input-type=module -e "
import('./src/lib/validation/alert-rule.ts').then(({ alertRuleSchema, chatIdSchema }) => {
  console.log('chatId valid:', chatIdSchema.safeParse('123456').success);
  console.log('chatId invalid:', chatIdSchema.safeParse('abc').success);
  console.log('rule missing recipients:', alertRuleSchema.safeParse({
    siteId: 'site-001', name: 'x', violationTypes: [], channels: ['telegram'],
    recipients: [], threshold: 1, cooldownSec: 180, isActive: true,
  }).success);
  console.log('rule ok:', alertRuleSchema.safeParse({
    siteId: 'site-001', name: 'x', violationTypes: [], channels: ['telegram'],
    recipients: ['123456'], threshold: 1, cooldownSec: 180, isActive: true,
  }).success);
});
"
```
Expected: `chatId valid: true`, `chatId invalid: false`, `rule missing recipients: false`, `rule ok: true`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/validation/alert-rule.ts
git commit -m "feat(alert-rules): add shared zod validation for AlertRule"
```

---

### Task 5: `notifyViolation` — `src/lib/alert-notifier.ts`

**Files:**
- Create: `src/lib/alert-notifier.ts`

**Interfaces:**
- Consumes: `TelegramClient` (Task 3, `sendPhoto`), `decrypt` (Task 2), `prisma` (`@/lib/prisma`), `AlertChannel.TELEGRAM` (Task 1).
- Produces: `notifyViolation(violation: Violation, camera: Camera): Promise<void>` (types `Violation`/`Camera` từ `@prisma/client`, không phải `@/types/models`).

- [ ] **Step 1: Viết `src/lib/alert-notifier.ts`**

```ts
// SPDX-License-Identifier: MIT

import type { Camera, Violation } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';
import { TelegramClient, type TelegramResult } from '@/lib/telegram';
import { AlertChannel } from '@/types/enums';

interface MatchedRule {
  id: string;
  recipients: string[];
  cooldownSec: number;
  threshold: number;
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function findMatchingRules(violation: Violation, camera: Camera): Promise<MatchedRule[]> {
  const rules = await prisma.alertRule.findMany({
    where: { siteId: camera.siteId, isActive: true },
  });

  return rules
    .filter((rule) => {
      const channels = parseJsonArray(rule.channels);
      if (!channels.includes(AlertChannel.TELEGRAM)) return false;
      const violationTypes = parseJsonArray(rule.violationTypes);
      return violationTypes.length === 0 || violationTypes.includes(violation.type);
    })
    .map((rule) => ({
      id: rule.id,
      recipients: parseJsonArray(rule.recipients),
      cooldownSec: rule.cooldownSec,
      threshold: rule.threshold,
    }));
}

// threshold<=1 (mặc định) = báo ngay vi phạm đầu tiên, bỏ qua bước đếm.
// threshold>1 = đếm số Violation cùng site+loại trong cooldownSec gần nhất,
// dùng chung cooldownSec làm cửa sổ đếm (không tách field riêng, xem Global Constraints spec).
async function isBelowThreshold(rule: MatchedRule, violation: Violation, camera: Camera): Promise<boolean> {
  if (rule.threshold <= 1) return false;
  const since = new Date(Date.now() - rule.cooldownSec * 1000);
  const count = await prisma.violation.count({
    where: { siteId: camera.siteId, type: violation.type, detectedAt: { gte: since } },
  });
  return count < rule.threshold;
}

async function isInCooldown(rule: MatchedRule): Promise<boolean> {
  const lastAlert = await prisma.alert.findFirst({
    where: { ruleId: rule.id },
    orderBy: { sentAt: 'desc' },
  });
  if (!lastAlert) return false;
  const elapsedSec = (Date.now() - lastAlert.sentAt.getTime()) / 1000;
  return elapsedSec < rule.cooldownSec;
}

async function sendToRecipients(rule: MatchedRule, violation: Violation, camera: Camera, botToken: string): Promise<void> {
  const client = new TelegramClient(botToken);
  const caption =
    `⚠️ <b>Cảnh báo vi phạm ATLĐ</b>\n` +
    `Loại vi phạm: ${violation.type}\n` +
    `Camera: ${camera.name}\n` +
    `Thời gian: ${violation.detectedAt.toISOString()}`;

  for (const chatId of rule.recipients) {
    let result: TelegramResult;
    try {
      result = await client.sendPhoto(chatId, violation.snapshotUrl, caption);
    } catch (err) {
      result = { ok: false, description: err instanceof Error ? err.message : String(err) };
    }
    // status không set -> dùng default "NEW" của Prisma, giống cách Violation.create() không set status
    await prisma.alert.create({
      data: {
        violationId: violation.id,
        ruleId: rule.id,
        channel: AlertChannel.TELEGRAM,
        recipient: chatId,
        errorMessage: result.ok ? null : result.description,
      },
    });
  }
}

export async function notifyViolation(violation: Violation, camera: Camera): Promise<void> {
  const settings = await prisma.telegramSettings.findFirst();
  if (!settings || !settings.isEnabled || !settings.botTokenEncrypted) return;

  const rules = await findMatchingRules(violation, camera);
  if (rules.length === 0) return;

  const botToken = decrypt(settings.botTokenEncrypted);

  for (const rule of rules) {
    if (await isBelowThreshold(rule, violation, camera)) continue;
    if (await isInCooldown(rule)) continue;
    await sendToRecipients(rule, violation, camera, botToken);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: không lỗi liên quan `src/lib/alert-notifier.ts` (xác nhận `TelegramResult` export từ Task 3 khớp import ở đây).

- [ ] **Step 3: Commit**

```bash
git add src/lib/alert-notifier.ts
git commit -m "feat(telegram): add notifyViolation with threshold/cooldown matching"
```

---

### Task 6: Gắn hook vào `POST /api/violations`

**Files:**
- Modify: `src/app/api/violations/route.ts`

**Interfaces:**
- Consumes: `notifyViolation(violation, camera)` (Task 5).

- [ ] **Step 1: Thêm import và gọi `notifyViolation` sau khi tạo `Violation`**

Trong `src/app/api/violations/route.ts`, thêm import ở đầu file:

```ts
import { notifyViolation } from '@/lib/alert-notifier';
```

Sửa cuối hàm `POST` — hiện tại là:

```ts
  const violation = await prisma.violation.create({
    data: {
      cameraId,
      siteId: camera.siteId,
      zoneId,
      type,
      severity,
      confidence,
      bboxData: JSON.stringify(bboxData),
      snapshotUrl,
    },
  });

  return NextResponse.json(violation, { status: 201 });
```

Sửa thành:

```ts
  const violation = await prisma.violation.create({
    data: {
      cameraId,
      siteId: camera.siteId,
      zoneId,
      type,
      severity,
      confidence,
      bboxData: JSON.stringify(bboxData),
      snapshotUrl,
    },
  });

  // ponytail: fire-and-forget vì server chạy long-lived process (dev-all.sh),
  // KHÔNG await — yolo_inference.py đang chặn frame loop chờ response này.
  // Nếu chuyển sang serverless (Vercel functions) phải đổi sang waitUntil/queue.
  notifyViolation(violation, camera).catch((err) => console.error('[telegram] notify failed', err));

  return NextResponse.json(violation, { status: 201 });
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 3: Verify thủ công end-to-end (chưa cần bot token thật)**

Chạy dev server ở 1 terminal:
```bash
npm run dev:web
```
Ở terminal khác, tạo vi phạm giả lập cho `cam-001` (đã seed sẵn, thuộc `site-001`):
```bash
curl -s -X POST http://localhost:3000/api/violations \
  -H "Content-Type: application/json" \
  -H "x-ai-engine-secret: 0iLSTUH4zbTgXrjMiUW9FFASK22Fbr99" \
  -d '{"cameraId":"cam-001","type":"hard_hat","severity":"critical","confidence":0.95,"bboxData":[{"x":0.1,"y":0.1,"width":0.2,"height":0.3,"label":"no_helmet","confidence":0.95}],"snapshotUrl":"/snapshots/test.jpg"}' \
  -w "\nHTTP %{http_code} in %{time_total}s\n"
```
Expected: `HTTP 201` trả về nhanh (< 1s) dù `TelegramSettings` chưa được bật (Task 5's `notifyViolation` return sớm khi `!isEnabled`) — response không bị chậm bởi bước gọi Telegram. Kiểm tra terminal chạy `npm run dev:web` không có lỗi crash.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/violations/route.ts
git commit -m "feat(violations): trigger Telegram notification on new violation"
```

---

### Task 7: API Settings Telegram — `GET/POST /api/settings/telegram`, `POST /api/settings/telegram/test`

**Files:**
- Create: `src/app/api/settings/telegram/route.ts`
- Create: `src/app/api/settings/telegram/test/route.ts`

**Interfaces:**
- Consumes: `encrypt`/`decrypt` (Task 2), `TelegramClient` (Task 3), `prisma`.
- Produces: `GET /api/settings/telegram -> { isEnabled: boolean, hasToken: boolean }`; `POST /api/settings/telegram` body `{ botToken?: string, isEnabled?: boolean }` -> cùng shape; `POST /api/settings/telegram/test` body `{ botToken?: string }` -> `{ success: boolean, botInfo?: unknown, error?: string }`.

- [ ] **Step 1: Viết `src/app/api/settings/telegram/route.ts`**

```ts
// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/crypto';

async function getOrCreateSettings() {
  const existing = await prisma.telegramSettings.findFirst();
  if (existing) return existing;
  return prisma.telegramSettings.create({ data: {} });
}

export async function GET() {
  const settings = await getOrCreateSettings();
  return NextResponse.json({
    isEnabled: settings.isEnabled,
    hasToken: !!settings.botTokenEncrypted,
  });
}

const updateSchema = z.object({
  botToken: z.string().min(1).optional(),
  isEnabled: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await getOrCreateSettings();
  const data: { botTokenEncrypted?: string; isEnabled?: boolean } = {};
  if (parsed.data.botToken) data.botTokenEncrypted = encrypt(parsed.data.botToken);
  if (parsed.data.isEnabled !== undefined) data.isEnabled = parsed.data.isEnabled;

  const updated = await prisma.telegramSettings.update({ where: { id: settings.id }, data });
  return NextResponse.json({ isEnabled: updated.isEnabled, hasToken: !!updated.botTokenEncrypted });
}
```

- [ ] **Step 2: Viết `src/app/api/settings/telegram/test/route.ts`**

```ts
// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';
import { TelegramClient } from '@/lib/telegram';

const testSchema = z.object({ botToken: z.string().min(1).optional() });

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let botToken = parsed.data.botToken;
  if (!botToken) {
    const settings = await prisma.telegramSettings.findFirst();
    if (!settings?.botTokenEncrypted) {
      return NextResponse.json({ success: false, error: 'Chưa cấu hình token' }, { status: 400 });
    }
    botToken = decrypt(settings.botTokenEncrypted);
  }

  const result = await new TelegramClient(botToken).getMe();
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.description }, { status: 400 });
  }
  return NextResponse.json({ success: true, botInfo: result.result });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Verify thủ công bằng curl**

Với `npm run dev:web` đang chạy:
```bash
curl -s http://localhost:3000/api/settings/telegram
# Expected: {"isEnabled":false,"hasToken":false}

curl -s -X POST http://localhost:3000/api/settings/telegram \
  -H "Content-Type: application/json" -d '{"botToken":"111:fake-token-for-test","isEnabled":true}'
# Expected: {"isEnabled":true,"hasToken":true}

curl -s http://localhost:3000/api/settings/telegram
# Expected: {"isEnabled":true,"hasToken":true} -- xác nhận đã lưu

curl -s -X POST http://localhost:3000/api/settings/telegram/test -H "Content-Type: application/json" -d '{}'
# Expected: {"success":false,"error":"..."} -- token giả nên Telegram từ chối, không crash

sqlite3 prisma/dev.db "SELECT isEnabled, length(botTokenEncrypted) FROM TelegramSettings;"
# Expected: 1 dòng, isEnabled=1, độ dài botTokenEncrypted > 0 và KHÔNG chứa "fake-token" (đã mã hoá)
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/settings/telegram
git commit -m "feat(telegram): add settings CRUD and test-connection API routes"
```

---

### Task 8: API AlertRule — `GET/POST /api/alert-rules`, `PATCH/DELETE /api/alert-rules/[id]`

**Files:**
- Create: `src/app/api/alert-rules/route.ts`
- Create: `src/app/api/alert-rules/[id]/route.ts`

**Interfaces:**
- Consumes: `alertRuleSchema`, `alertRuleObjectSchema` (Task 4), `auth` (`@/auth`), `prisma`, `UserRole` (`@/types/enums`).
- Produces: `GET /api/alert-rules?siteId= -> AlertRuleRow[]`, `POST /api/alert-rules -> AlertRuleRow` (201), `PATCH /api/alert-rules/[id] -> AlertRuleRow`, `DELETE /api/alert-rules/[id] -> { success: true }`. `AlertRuleRow = { id, siteId, name, violationTypes: string[], channels: string[], recipients: string[], threshold, cooldownSec, isActive, createdAt, updatedAt }`.

- [ ] **Step 1: Viết `src/app/api/alert-rules/route.ts`**

```ts
// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import type { AlertRule as AlertRuleRow } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { alertRuleSchema } from '@/lib/validation/alert-rule';

function serializeRule(rule: AlertRuleRow) {
  return {
    ...rule,
    violationTypes: JSON.parse(rule.violationTypes),
    channels: JSON.parse(rule.channels),
    recipients: JSON.parse(rule.recipients),
  };
}

export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('siteId');
  const rules = await prisma.alertRule.findMany({
    where: siteId ? { siteId } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(rules.map(serializeRule));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = alertRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { violationTypes, channels, recipients, ...rest } = parsed.data;
  const rule = await prisma.alertRule.create({
    data: {
      ...rest,
      violationTypes: JSON.stringify(violationTypes),
      channels: JSON.stringify(channels),
      recipients: JSON.stringify(recipients),
    },
  });
  return NextResponse.json(serializeRule(rule), { status: 201 });
}
```

- [ ] **Step 2: Viết `src/app/api/alert-rules/[id]/route.ts`**

```ts
// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import type { AlertRule as AlertRuleRow } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { alertRuleObjectSchema, alertRuleSchema } from '@/lib/validation/alert-rule';
import { UserRole } from '@/types/enums';

const ORG_WIDE_ROLES: string[] = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN];

function serializeRule(rule: AlertRuleRow) {
  return {
    ...rule,
    violationTypes: JSON.parse(rule.violationTypes),
    channels: JSON.parse(rule.channels),
    recipients: JSON.parse(rule.recipients),
  };
}

async function assertSiteAccess(siteId: string): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ORG_WIDE_ROLES.includes(session.user.role)) return null;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const assignedSites: string[] = user ? JSON.parse(user.assignedSites) : [];
  if (!assignedSites.includes(siteId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.alertRule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const authError = await assertSiteAccess(existing.siteId);
  if (authError) return authError;

  const body = await request.json();
  const parsedPatch = alertRuleObjectSchema.partial().safeParse(body);
  if (!parsedPatch.success) {
    return NextResponse.json({ error: parsedPatch.error.flatten() }, { status: 400 });
  }

  const merged = {
    siteId: existing.siteId,
    name: existing.name,
    violationTypes: JSON.parse(existing.violationTypes),
    channels: JSON.parse(existing.channels),
    recipients: JSON.parse(existing.recipients),
    threshold: existing.threshold,
    cooldownSec: existing.cooldownSec,
    isActive: existing.isActive,
    ...parsedPatch.data,
  };
  const parsedMerged = alertRuleSchema.safeParse(merged);
  if (!parsedMerged.success) {
    return NextResponse.json({ error: parsedMerged.error.flatten() }, { status: 400 });
  }

  const { violationTypes, channels, recipients, ...rest } = parsedMerged.data;
  const updated = await prisma.alertRule.update({
    where: { id },
    data: {
      ...rest,
      violationTypes: JSON.stringify(violationTypes),
      channels: JSON.stringify(channels),
      recipients: JSON.stringify(recipients),
    },
  });
  return NextResponse.json(serializeRule(updated));
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.alertRule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const authError = await assertSiteAccess(existing.siteId);
  if (authError) return authError;

  await prisma.alertRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Verify thủ công bằng curl**

```bash
curl -s -X POST http://localhost:3000/api/alert-rules -H "Content-Type: application/json" -d '{
  "siteId":"site-001","name":"Test rule","violationTypes":[],"channels":["telegram"],
  "recipients":["123456789"],"threshold":1,"cooldownSec":180,"isActive":true
}'
# Expected: 201, JSON trả về đã có id, violationTypes/channels/recipients là ARRAY (không phải string)

curl -s "http://localhost:3000/api/alert-rules?siteId=site-001"
# Expected: mảng chứa rule vừa tạo

curl -s -X POST http://localhost:3000/api/alert-rules -H "Content-Type: application/json" -d '{
  "siteId":"site-001","name":"Rule câm","violationTypes":[],"channels":["telegram"],
  "recipients":[],"threshold":1,"cooldownSec":180,"isActive":true
}'
# Expected: 400 -- channels có telegram nhưng recipients rỗng

# PATCH/DELETE cần session đăng nhập (auth() check) -- verify đầy đủ qua UI ở Task 14
# sau khi có form login; ở đây chỉ xác nhận route trả 401 khi gọi thẳng không cookie:
curl -s -X DELETE "http://localhost:3000/api/alert-rules/<id-vừa-tạo>" -w "\nHTTP %{http_code}\n"
# Expected: HTTP 401 (chưa đăng nhập)
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/alert-rules
git commit -m "feat(alert-rules): add CRUD API with site-scoped authorization"
```

---

### Task 9: Tách UI primitives dùng chung của Settings — `src/components/settings/ui.tsx`

**Files:**
- Create: `src/components/settings/ui.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx`

**Interfaces:**
- Produces: `SectionHeader`, `SettingCard`, `InputGroup`, `Switch` (React components, cùng props như bản gốc trong `page.tsx`).

Lý do: `TelegramBotCard`/`AlertRulesCard` (Task 11, 12) cần dùng lại đúng 4 component UI này đang định nghĩa cục bộ (không export) trong `settings/page.tsx`. Tách ra file riêng để dùng chung, không copy-paste style.

- [ ] **Step 1: Viết `src/components/settings/ui.tsx`** — copy nguyên 4 hàm từ `page.tsx`, thêm `export`:

```tsx
'use client';
// SPDX-License-Identifier: MIT

import { cn } from '@/lib/utils';

export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-[var(--text-primary)]">{title}</h2>
      <p className="text-sm text-[var(--text-muted)]">{description}</p>
    </div>
  );
}

export function SettingCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function InputGroup({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[var(--text-secondary)]">{label}</label>
      {children}
      {description && <p className="text-xs text-[var(--text-muted)]">{description}</p>}
    </div>
  );
}

export function Switch({ enabled, onChange, label, description }: { enabled: boolean; onChange: (val: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
        {description && <span className="text-xs text-[var(--text-muted)]">{description}</span>}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        type="button"
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
          enabled ? "bg-[var(--primary)]" : "bg-[var(--border-subtle)]"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
            enabled ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Sửa `src/app/(dashboard)/settings/page.tsx`** — xoá 4 định nghĩa hàm cục bộ (`SectionHeader`, `SettingCard`, `InputGroup`, `Switch`), thêm import:

```ts
import { SectionHeader, SettingCard, InputGroup, Switch } from '@/components/settings/ui';
```

- [ ] **Step 3: Typecheck + kiểm tra UI không đổi**

Run: `npx tsc --noEmit`
Chạy `npm run dev:web`, mở `/settings`, xác nhận 4 tab (Profile/Monitoring/Notifications/Security) hiển thị y hệt trước khi tách file — không đổi giao diện, chỉ đổi chỗ định nghĩa.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/ui.tsx "src/app/(dashboard)/settings/page.tsx"
git commit -m "refactor(settings): extract shared UI primitives to components/settings/ui.tsx"
```

---

### Task 10: React Query hooks — `use-telegram-settings.ts`, `use-alert-rules.ts`

**Files:**
- Create: `src/hooks/use-telegram-settings.ts`
- Create: `src/hooks/use-alert-rules.ts`

**Interfaces:**
- Consumes: API routes từ Task 7, 8.
- Produces: `useTelegramSettings()`, `useSaveTelegramSettings()`, `useTestTelegramConnection()`; `useAlertRules(siteId?)`, `useCreateAlertRule()`, `useUpdateAlertRule()`, `useDeleteAlertRule()`, `interface AlertRuleView { id, siteId, name, violationTypes: string[], channels: string[], recipients: string[], threshold: number, cooldownSec: number, isActive: boolean, createdAt: string, updatedAt: string }`.

- [ ] **Step 1: Viết `src/hooks/use-telegram-settings.ts`**

```ts
// SPDX-License-Identifier: MIT

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface TelegramSettingsView {
  isEnabled: boolean;
  hasToken: boolean;
}

export function useTelegramSettings() {
  return useQuery<TelegramSettingsView>({
    queryKey: ['telegram-settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings/telegram');
      if (!res.ok) throw new Error('Failed to fetch Telegram settings');
      return res.json();
    },
  });
}

export function useSaveTelegramSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { botToken?: string; isEnabled?: boolean }) => {
      const res = await fetch('/api/settings/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save Telegram settings');
      return res.json() as Promise<TelegramSettingsView>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['telegram-settings'] }),
  });
}

export function useTestTelegramConnection() {
  return useMutation({
    mutationFn: async (botToken?: string) => {
      const res = await fetch('/api/settings/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Kiểm tra kết nối thất bại');
      return data as { success: true; botInfo: unknown };
    },
  });
}
```

- [ ] **Step 2: Viết `src/hooks/use-alert-rules.ts`**

```ts
// SPDX-License-Identifier: MIT

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface AlertRuleView {
  id: string;
  siteId: string;
  name: string;
  violationTypes: string[];
  channels: string[];
  recipients: string[];
  threshold: number;
  cooldownSec: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AlertRuleInput = Omit<AlertRuleView, 'id' | 'createdAt' | 'updatedAt'>;

export function useAlertRules(siteId?: string) {
  return useQuery<AlertRuleView[]>({
    queryKey: ['alert-rules', siteId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (siteId) params.append('siteId', siteId);
      const res = await fetch(`/api/alert-rules?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch alert rules');
      return res.json();
    },
    enabled: !!siteId,
  });
}

export function useCreateAlertRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: AlertRuleInput) => {
      const res = await fetch('/api/alert-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create alert rule');
      return res.json() as Promise<AlertRuleView>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-rules'] }),
  });
}

export function useUpdateAlertRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AlertRuleInput> }) => {
      const res = await fetch(`/api/alert-rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update alert rule');
      return res.json() as Promise<AlertRuleView>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-rules'] }),
  });
}

export function useDeleteAlertRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/alert-rules/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete alert rule');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-rules'] }),
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-telegram-settings.ts src/hooks/use-alert-rules.ts
git commit -m "feat(telegram): add react-query hooks for settings and alert rules"
```

---

### Task 11: `TelegramBotCard` component

**Files:**
- Create: `src/components/settings/TelegramBotCard.tsx`

**Interfaces:**
- Consumes: `SectionHeader`, `SettingCard`, `InputGroup`, `Switch` (Task 9); `useTelegramSettings`, `useSaveTelegramSettings`, `useTestTelegramConnection` (Task 10); `toast` (`@/lib/toast`).
- Produces: `<TelegramBotCard />` (không nhận props).

- [ ] **Step 1: Viết `src/components/settings/TelegramBotCard.tsx`**

```tsx
'use client';
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { Eye, EyeOff, Bot, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { SectionHeader, SettingCard, InputGroup, Switch } from './ui';
import {
  useTelegramSettings,
  useSaveTelegramSettings,
  useTestTelegramConnection,
} from '@/hooks/use-telegram-settings';

export function TelegramBotCard() {
  const { data: settings } = useTelegramSettings();
  const saveSettings = useSaveTelegramSettings();
  const testConnection = useTestTelegramConnection();
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);

  const handleTest = async () => {
    try {
      await testConnection.mutateAsync(tokenInput || undefined);
      toast('Kết nối Telegram thành công', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kiểm tra kết nối thất bại', 'error');
    }
  };

  const handleSave = async () => {
    try {
      await saveSettings.mutateAsync({ botToken: tokenInput || undefined });
      setTokenInput('');
      toast('Đã lưu cấu hình Telegram', 'success');
    } catch {
      toast('Lưu cấu hình thất bại', 'error');
    }
  };

  const handleToggle = async (enabled: boolean) => {
    try {
      await saveSettings.mutateAsync({ isEnabled: enabled });
    } catch {
      toast('Cập nhật trạng thái thất bại', 'error');
    }
  };

  return (
    <SettingCard>
      <SectionHeader title="Bot Telegram" description="Kết nối bot để gửi cảnh báo vi phạm qua Telegram." />
      <div className="space-y-4">
        <Switch
          enabled={!!settings?.isEnabled}
          onChange={handleToggle}
          label="Bật cảnh báo Telegram"
          description="Tắt sẽ dừng gửi ở mọi quy tắc cảnh báo"
        />
        <InputGroup
          label="Bot Token"
          description="Lấy token từ @BotFather. Để trống nếu không muốn đổi token đã lưu."
        >
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder={settings?.hasToken ? 'Đã cấu hình' : 'Dán bot token vào đây'}
              className="w-full px-4 py-2.5 pr-10 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] focus:border-[var(--primary)] text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </InputGroup>
        <div className="flex gap-2">
          <button
            onClick={handleTest}
            disabled={testConnection.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            {testConnection.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            <Bot className="w-4 h-4" />
            Kiểm tra kết nối
          </button>
          <button
            onClick={handleSave}
            disabled={saveSettings.isPending}
            className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-bold hover:bg-[var(--primary-hover)] disabled:opacity-50"
          >
            Lưu
          </button>
        </div>
      </div>
    </SettingCard>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/TelegramBotCard.tsx
git commit -m "feat(telegram): add TelegramBotCard settings UI"
```

---

### Task 12: `AlertRuleEditDialog` + `AlertRulesCard`

**Files:**
- Create: `src/components/settings/AlertRuleEditDialog.tsx`
- Create: `src/components/settings/AlertRulesCard.tsx`

**Interfaces:**
- Consumes: `chatIdSchema` (Task 4); `AlertRuleView`, `useAlertRules`, `useCreateAlertRule`, `useUpdateAlertRule`, `useDeleteAlertRule` (Task 10); `useSites` (`@/hooks/use-sites`, đã có sẵn); `SectionHeader`, `SettingCard` (Task 9); `AlertChannel`, `ViolationType` (`@/types/enums`); `toast`.
- Produces: `<AlertRuleEditDialog rule={AlertRuleView | null} siteId={string} isOpen={boolean} onClose={() => void} />`, `<AlertRulesCard />` (không props).

- [ ] **Step 1: Viết `src/components/settings/AlertRuleEditDialog.tsx`**

```tsx
'use client';
// SPDX-License-Identifier: MIT

import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { ViolationType, AlertChannel } from '@/types/enums';
import { chatIdSchema } from '@/lib/validation/alert-rule';
import { useCreateAlertRule, useUpdateAlertRule, type AlertRuleView } from '@/hooks/use-alert-rules';

interface AlertRuleEditDialogProps {
  rule: AlertRuleView | null;
  siteId: string;
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_FORM = {
  name: '',
  violationTypes: [] as string[],
  channels: [] as string[],
  recipients: [] as string[],
  threshold: 1,
  cooldownSec: 180,
  isActive: true,
};

export function AlertRuleEditDialog({ rule, siteId, isOpen, onClose }: AlertRuleEditDialogProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [chatIdInput, setChatIdInput] = useState('');
  const createRule = useCreateAlertRule();
  const updateRule = useUpdateAlertRule();

  useEffect(() => {
    if (isOpen) {
      setForm(
        rule
          ? {
              name: rule.name,
              violationTypes: rule.violationTypes,
              channels: rule.channels,
              recipients: rule.recipients,
              threshold: rule.threshold,
              cooldownSec: rule.cooldownSec,
              isActive: rule.isActive,
            }
          : EMPTY_FORM
      );
      setChatIdInput('');
    }
  }, [isOpen, rule]);

  const toggleInArray = (arr: string[], value: string): string[] =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const addChatId = () => {
    const parsed = chatIdSchema.safeParse(chatIdInput.trim());
    if (!parsed.success) {
      toast(parsed.error.issues[0].message, 'error');
      return;
    }
    if (form.recipients.includes(parsed.data)) return;
    setForm({ ...form, recipients: [...form.recipients, parsed.data] });
    setChatIdInput('');
  };

  const handleSave = async () => {
    if (form.channels.includes(AlertChannel.TELEGRAM) && form.recipients.length === 0) {
      toast('Cần ít nhất 1 người nhận khi bật kênh Telegram', 'error');
      return;
    }
    try {
      if (rule) {
        await updateRule.mutateAsync({ id: rule.id, data: { ...form, siteId } });
      } else {
        await createRule.mutateAsync({ ...form, siteId });
      }
      toast('Đã lưu quy tắc cảnh báo', 'success');
      onClose();
    } catch {
      toast('Lưu quy tắc thất bại', 'error');
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl rounded-xl max-h-[85vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-bold text-[var(--text-primary)]">
            {rule ? 'Sửa quy tắc cảnh báo' : 'Thêm quy tắc cảnh báo'}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-[var(--text-muted)]">
            Chọn loại vi phạm, kênh gửi và người nhận cho công trường này.
          </Dialog.Description>

          <div className="grid gap-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">Tên quy tắc</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="VD: Cảnh báo thiếu mũ bảo hộ"
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Loại vi phạm (bỏ trống = tất cả)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(ViolationType).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm({ ...form, violationTypes: toggleInArray(form.violationTypes, type) })}
                    className={cn(
                      "px-2.5 py-1 rounded-lg border text-[11px] font-medium",
                      form.violationTypes.includes(type)
                        ? "bg-[var(--primary-muted)] border-[var(--primary)] text-[var(--primary-light)]"
                        : "bg-[var(--background)] border-[var(--border)] text-[var(--text-secondary)]"
                    )}
                  >
                    {type.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Kênh gửi</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(AlertChannel).map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => setForm({ ...form, channels: toggleInArray(form.channels, channel) })}
                    className={cn(
                      "px-2.5 py-1 rounded-lg border text-[11px] font-medium",
                      form.channels.includes(channel)
                        ? "bg-[var(--primary-muted)] border-[var(--primary)] text-[var(--primary-light)]"
                        : "bg-[var(--background)] border-[var(--border)] text-[var(--text-secondary)]"
                    )}
                  >
                    {channel}
                  </button>
                ))}
              </div>
            </div>

            {form.channels.includes(AlertChannel.TELEGRAM) && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Chat ID người nhận Telegram
                </label>
                <p className="text-[10px] text-[var(--text-muted)]">
                  Cá nhân: nhắn <code>@userinfobot</code> hoặc <code>/start</code> bot rồi gọi <code>getUpdates</code>.
                  Nhóm: thêm bot vào group trước, <code>getUpdates</code> mới ra id âm (<code>@userinfobot</code> không dùng được cho group).
                </p>
                <div className="flex gap-2">
                  <input
                    value={chatIdInput}
                    onChange={(e) => setChatIdInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChatId(); } }}
                    placeholder="VD: 123456789 hoặc -1001234567890"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={addChatId}
                    className="px-3 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-hover)]"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {form.recipients.map((chatId) => (
                    <div key={chatId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)]">
                      <span className="text-xs font-mono text-[var(--text-primary)]">{chatId}</span>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, recipients: form.recipients.filter((c) => c !== chatId) })}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-[var(--danger)]" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--text-secondary)]">Ngưỡng (số vi phạm)</label>
                <input
                  type="number"
                  min={1}
                  value={form.threshold}
                  onChange={(e) => setForm({ ...form, threshold: Math.max(1, Number(e.target.value)) })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--text-secondary)]">Cooldown (giây)</label>
                <input
                  type="number"
                  min={0}
                  value={form.cooldownSec}
                  onChange={(e) => setForm({ ...form, cooldownSec: Math.max(0, Number(e.target.value)) })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--surface-hover)]">
              Huỷ
            </button>
            <button
              onClick={handleSave}
              disabled={createRule.isPending || updateRule.isPending}
              className="px-6 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-bold hover:bg-[var(--primary-hover)] disabled:opacity-50"
            >
              Lưu
            </button>
          </div>

          <Dialog.Close className="absolute right-4 top-4">
            <X className="h-4 w-4 text-[var(--text-muted)]" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Viết `src/components/settings/AlertRulesCard.tsx`**

```tsx
'use client';
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { Plus, Pencil, Trash2, Send } from 'lucide-react';
import { toast } from '@/lib/toast';
import { SectionHeader, SettingCard } from './ui';
import { useSites } from '@/hooks/use-sites';
import { useAlertRules, useDeleteAlertRule, type AlertRuleView } from '@/hooks/use-alert-rules';
import { AlertRuleEditDialog } from './AlertRuleEditDialog';
import { AlertChannel } from '@/types/enums';

export function AlertRulesCard() {
  const { data: sites } = useSites();
  const [siteId, setSiteId] = useState<string>('');
  const activeSiteId = siteId || sites?.[0]?.id || '';
  const { data: rules } = useAlertRules(activeSiteId);
  const deleteRule = useDeleteAlertRule();
  const [editingRule, setEditingRule] = useState<AlertRuleView | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAdd = () => {
    setEditingRule(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (rule: AlertRuleView) => {
    setEditingRule(rule);
    setIsDialogOpen(true);
  };

  const handleDelete = async (rule: AlertRuleView) => {
    if (!confirm(`Xoá quy tắc "${rule.name}"?`)) return;
    try {
      await deleteRule.mutateAsync(rule.id);
      toast('Đã xoá quy tắc cảnh báo', 'success');
    } catch {
      toast('Xoá quy tắc thất bại', 'error');
    }
  };

  return (
    <SettingCard>
      <div className="flex items-center justify-between mb-6">
        <SectionHeader title="Quy tắc cảnh báo" description="Định nghĩa khi nào và gửi cảnh báo cho ai theo từng công trường." />
        <select
          value={activeSiteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-sm outline-none"
        >
          {sites?.map((site) => (
            <option key={site.id} value={site.id}>{site.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {rules?.map((rule) => (
          <div key={rule.id} className="flex items-center justify-between p-4 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)]">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-[var(--text-primary)]">{rule.name}</h4>
                {rule.channels.includes(AlertChannel.TELEGRAM) && (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--primary-muted)] text-[var(--primary-light)]">
                    <Send className="w-2.5 h-2.5" /> Telegram
                  </span>
                )}
                {!rule.isActive && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--border)] text-[var(--text-muted)]">Tắt</span>
                )}
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                {rule.recipients.length} người nhận · ngưỡng {rule.threshold} · cooldown {rule.cooldownSec}s
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleEdit(rule)} className="p-2 rounded-lg hover:bg-[var(--surface-hover)]">
                <Pencil className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
              <button onClick={() => handleDelete(rule)} className="p-2 rounded-lg hover:bg-[var(--surface-hover)]">
                <Trash2 className="w-4 h-4 text-[var(--danger)]" />
              </button>
            </div>
          </div>
        ))}
        {rules?.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] text-center py-6">Chưa có quy tắc nào cho công trường này.</p>
        )}
      </div>

      <button
        onClick={handleAdd}
        disabled={!activeSiteId}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50"
      >
        <Plus className="w-4 h-4" /> Thêm quy tắc
      </button>

      <AlertRuleEditDialog
        rule={editingRule}
        siteId={activeSiteId}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </SettingCard>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/AlertRuleEditDialog.tsx src/components/settings/AlertRulesCard.tsx
git commit -m "feat(alert-rules): add AlertRuleEditDialog and AlertRulesCard UI"
```

---

### Task 13: Nối vào tab "Thông báo" của Settings

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx`

**Interfaces:**
- Consumes: `TelegramBotCard` (Task 11), `AlertRulesCard` (Task 12).

- [ ] **Step 1: Thêm import**

```ts
import { TelegramBotCard } from '@/components/settings/TelegramBotCard';
import { AlertRulesCard } from '@/components/settings/AlertRulesCard';
```

- [ ] **Step 2: Chèn 2 component vào khối `activeTab === 'notifications'`**

Tìm khối:
```tsx
{activeTab === 'notifications' && (
  <div className="space-y-6 animate-fade-up">
    <SettingCard>
      <SectionHeader 
        title="Kênh Cảnh báo" 
        ...
      </SettingCard>
  </div>
)}
```

Sửa thành (giữ nguyên `SettingCard` "Kênh Cảnh báo" hiện có, chèn thêm 2 card mới ngay sau):

```tsx
{activeTab === 'notifications' && (
  <div className="space-y-6 animate-fade-up">
    <SettingCard>
      <SectionHeader 
        title="Kênh Cảnh báo" 
        description="Cấu hình nơi bạn nhận thông báo an toàn thời gian thực." 
      />
      <div className="space-y-4">
        {[
          { id: 'email', label: 'Cảnh báo Email', icon: Mail, color: 'var(--primary)', desc: 'Gửi tới admin@safesight.ai' },
          { id: 'push', label: 'Thông báo Đẩy', icon: Smartphone, color: 'var(--success)', desc: 'Ứng dụng Di động & Trình duyệt' },
          { id: 'siren', label: 'Kích hoạt Còi báo động', icon: Siren, color: 'var(--danger)', desc: 'Kích hoạt còi phần cứng' },
        ].map((channel) => (
          <div key={channel.id} className="flex items-center justify-between p-4 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] hover:border-[var(--primary)]/30 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--surface)]" style={{ color: channel.color }}>
                <channel.icon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[var(--text-primary)]">{channel.label}</h4>
                <p className="text-[10px] text-[var(--text-muted)]">{channel.desc}</p>
              </div>
            </div>
            <Switch enabled={channel.id !== 'siren'} label="" onChange={() => {}} />
          </div>
        ))}
      </div>
    </SettingCard>
    <TelegramBotCard />
    <AlertRulesCard />
  </div>
)}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Verify bằng browser**

Chạy `npm run dev:web`, mở `/settings`, click tab "Thông báo". Expected: thấy 3 card theo thứ tự — "Kênh Cảnh báo" (như cũ) → "Bot Telegram" (mới) → "Quy tắc cảnh báo" (mới, có dropdown chọn site).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/settings/page.tsx"
git commit -m "feat(settings): wire Telegram bot config and alert rules into notifications tab"
```

---

### Task 14: Kiểm tra thủ công đầu-cuối + build check

**Files:** không tạo/sửa file (chỉ verify).

- [ ] **Step 1: Build + lint**

```bash
npm run lint
npm run build
```
Expected: cả 2 pass không lỗi.

- [ ] **Step 2: Cấu hình bot token thật qua UI**

Chạy `npm run dev`, đăng nhập bằng `admin@safesight.ai` / `password123` (tài khoản test có sẵn, role `SUPER_ADMIN`). Vào `/settings` → tab Thông báo → nhập bot token thật (từ @BotFather) vào "Bot Telegram" → bấm "Kiểm tra kết nối". Expected: toast báo thành công, hiện đúng tên bot.

- [ ] **Step 3: Bật tính năng + tạo AlertRule cho `site-001`**

Bật switch "Bật cảnh báo Telegram" → bấm "Lưu". Ở "Quy tắc cảnh báo", chọn site "Vinhomes Grand Park", bấm "Thêm quy tắc" — đặt tên, chọn kênh "telegram", thêm chat_id thật của anh (lấy qua `@userinfobot`), để "Loại vi phạm" trống (= tất cả), ngưỡng 1, cooldown 60 — Lưu.

- [ ] **Step 4: Bắn vi phạm giả lập, xác nhận nhận được tin Telegram**

```bash
curl -s -X POST http://localhost:3000/api/violations \
  -H "Content-Type: application/json" \
  -H "x-ai-engine-secret: 0iLSTUH4zbTgXrjMiUW9FFASK22Fbr99" \
  -d '{"cameraId":"cam-001","type":"hard_hat","severity":"critical","confidence":0.95,"bboxData":[{"x":0.1,"y":0.1,"width":0.2,"height":0.3,"label":"no_helmet","confidence":0.95}],"snapshotUrl":"/snapshots/test.jpg"}' \
  -w "\nHTTP %{http_code} in %{time_total}s\n"
```
Expected: `HTTP 201`, response nhanh (< 1s). Vài giây sau, điện thoại Telegram nhận được tin kèm ảnh (dùng ảnh có sẵn trong `public/snapshots/test.jpg` — nếu chưa có file này, copy tạm 1 ảnh bất kỳ vào đó trước khi chạy lệnh trên để `sendPhoto` không lỗi "file not found").

- [ ] **Step 5: Verify cooldown**

Chạy lại đúng lệnh curl ở Step 4 ngay lập tức (trong vòng 60s). Expected: `HTTP 201` vẫn trả về, nhưng **không** có tin Telegram thứ 2 (đang cooldown). Kiểm tra:
```bash
sqlite3 prisma/dev.db "SELECT channel, recipient, errorMessage, sentAt FROM Alert ORDER BY sentAt DESC LIMIT 5;"
```
Expected: chỉ 1 dòng `Alert` mới cho lần đầu, không có dòng cho lần gọi thứ 2 (vì bị chặn ở bước cooldown trước khi kịp tạo `Alert`).

- [ ] **Step 6: Verify tắt tính năng chặn gửi**

Tắt switch "Bật cảnh báo Telegram" trong UI. Đợi hết cooldown (>60s), gọi lại curl Step 4. Expected: `HTTP 201` vẫn nhanh, nhưng không có tin Telegram nào, không có `Alert` row mới.

- [ ] **Step 6b: Verify rule `isActive=false` hoặc khác site không gửi**

Bật lại switch "Bật cảnh báo Telegram". Trong UI, sửa rule vừa tạo, tắt toggle "isActive" của rule đó → Lưu. Gọi lại curl Step 4 (đợi hết cooldown trước). Expected: không có tin Telegram, không có `Alert` row mới. Bật lại `isActive`, đổi rule sang lọc theo 1 `violationTypes` khác (vd chỉ `safety_vest`) rồi gọi lại curl Step 4 với `"type":"hard_hat"`. Expected: cũng không gửi vì loại vi phạm không khớp — xác nhận qua `sqlite3 prisma/dev.db "SELECT COUNT(*) FROM Alert;"` không tăng.

- [ ] **Step 7: Verify phân quyền site**

Đăng xuất, đăng nhập bằng 1 user không phải `SUPER_ADMIN`/`ORG_ADMIN` và không có `site-001` trong `assignedSites` (kiểm tra `prisma/seed.mjs` để lấy email user phù hợp, hoặc tạo user test qua Prisma Studio: `npx prisma studio`). Thử sửa/xoá rule của `site-001` qua UI. Expected: request trả 403, UI hiện lỗi (toast "Xoá quy tắc thất bại"/"Lưu quy tắc thất bại"), rule không đổi.

- [ ] **Step 8: Xác nhận token không lộ**

```bash
curl -s http://localhost:3000/api/settings/telegram
```
Expected: chỉ có `isEnabled`/`hasToken`, không có trường nào chứa token thật.

- [ ] **Step 9: Commit dọn dẹp cuối (nếu có thay đổi phát sinh khi verify)**

Nếu Step 1-8 không cần sửa code gì thêm thì không cần commit ở bước này — plan coi như hoàn tất ở commit của Task 13.
