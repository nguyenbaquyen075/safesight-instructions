# Review fixes — kế hoạch nhánh (2026-09-08)

Nguồn: `docs/review/2026-09-07-health-worktree-c3clm7.md`, `docs/review/2026-09-07-change-2c3b9d3-8ac3758-9ovf61.md`, và hai lỗi quan sát khi chạy thật ngày 2026-09-08 (LLM proxy trả OpenAI format; SQLite write timeout).

Mỗi nhánh tách từ `main`, làm trong worktree riêng, phải xanh `npm run test:agent`, `npx tsc --noEmit`, `npx eslint .`, docs (wiki/README) cập nhật cùng commit, commit message tiếng Anh.

| Nhánh | Lỗi (key) | Phạm vi |
|---|---|---|
| `fix/agent-openai-compatible-llm` | runtime: proxy OpenAI format → `reading 'filter'` | `agent/lib/llm/openai.ts` (SessionClient qua `chat/completions`, fetch, không dependency mới), chọn bằng `LLM_PROVIDER=openai`; `agent/lib/env.ts`; `agent/session.ts` mapError HTTP; capability label; test với stub HTTP server; wiki/09, README, `.env.docker.example` |
| `fix/sqlite-write-contention` | runtime: `P1008 SocketTimeout` 62/66 ghi vi phạm | WAL + busy_timeout cho libsql (`src/lib/prisma.ts`), Python `_open_db_readonly` không giữ lock; tái hiện bằng script trước/sau |
| `fix/agent-stale-pid-heartbeat` | code/agent-direct/sigterm-to-stale-pid, agent-sweep/probe-delays, agent-cleanup/disk-pressure-never-clears | `agent/direct/{actions,health,sweep,cleanup}.ts`, `ai-engine/yolo_inference.py` xoá heartbeat khi thoát, tests |
| `fix/agent-ask-panel-feedback` | code/agent-session/token-cap-silences-ask-panel, agent-main/sigterm-sleeps-full-tick, agent-bridge/poke-before-enqueue, agent-ask/exhausted-task | `agent/session.ts`, `agent/main.ts`, `src/app/api/cameras/[id]/route.ts`, `src/app/api/agent/ask/route.ts`, tests |
| `fix/auth-dev-login-gate` | sec/auth/hardcoded-super-admin-backdoor | `src/auth.ts` gate theo `NODE_ENV`/`ALLOW_DEV_LOGIN`, README |
| `fix/bridge-detections-secret` | sec/deploy/bridge-published-to-all-interfaces, arch/deployment/state-split | `ai-engine/yolo_bridge.js` (+dotenv, header), `ai-engine/yolo_inference.py`, `docker-compose.yml` bind mount, wiki/03 |
| `fix/api-expose-occurrence-count` | docs/schema/violation-occurrencecount-not-exposed, code/violations/legacy-lowercase-status | GET mappings + `src/types/models.ts`, guard `JSON.parse(agentReview)`, chuẩn hoá status chữ hoa khi đọc |
| `fix/agent-tests` | tests/* | `agent/test/{usage,escalate,agent-bridge}.test.ts`, test PATCH status |
| `fix/deps-security-audit` | deps/* | next-auth beta.32, @auth/prisma-adapter 2.11.3, next 16.3.4, `npm audit fix` |
| `fix/sidebar-alert-badge-from-db` | arch/violations/dual-store-localstorage-vs-db (phần nhỏ) | Sidebar badge đếm từ `/api/violations`, sites page bỏ ghi `safesight_alerts` |

Hoãn (ghi vào lộ trình): `arch/ppe-tracker/god-method-process-frame` (refactor AI core cần nghiệm thu model, không làm trong đợt fix).

## Đợt 2 (2026-09-08, sau khi chạy security-review, code-review, ponytail-review, review-experience trên `ab4244d`)

| Nhánh | Lỗi | Phạm vi |
|---|---|---|
| `fix/api-session-scope` | GET `violations`, `violations/[id]`, `cameras`, `cameras/[id]`, `sites`, `sites/[id]`, `users` trả 200 không cần cookie (middleware bỏ qua `/api`); list không scope theo site; Sidebar poll cả bảng | `auth()` cho mọi GET, scope `assignedSites` cho vai trò không org-wide, filter đẩy vào Prisma, `GET /api/violations/count`, Sidebar dùng count |
| `fix/deploy-engine-env` | bind mount uid (container `app` vs host), migration từ named volume, engine nuốt 401 bridge, `mock_yolo.js` thiếu header, `BRIDGE_PORT` thừa | compose `user:`, entrypoint, wiki/03 migration, `yolo_inference.py` log 1 lần, `mock_yolo.js`, bỏ `BRIDGE_PORT` |
| `fix/agent-hardening-2` | non-Linux phantom `engine.stalled`; heartbeat >5 phút chặn restart engine treo; model mặc định `claude-opus-5` gửi tới proxy OpenAI; `anthropicClient` bỏ `LLM_BASE_URL`; race `ask` reuse vs `retireExhausted`; error event gán session cũ; cleanup xoá bằng chứng vi phạm còn mở; `openai.ts` gọn (BetaRunnableTool, APIError.generate, bỏ zod/override thừa, ảnh cũ thay stub) | `agent/direct/health.ts`, `actions.ts`, `cleanup.ts`, `agent/lib/settings.ts`, `agent/session.ts`, `agent/lib/llm/openai.ts`, `agent/main.ts`, `src/app/api/agent/{ask,settings}/route.ts` |
| `chore/conventions-round-2` | tiêu đề test tiếng Việt (health, openai-client), alias `anthropicKey`, `NavItem.badge` chết, helper test trùng, MODELS trùng, khối `nextjs-agent-rules` tự chèn vào AGENTS.md, badge không trừ "đã đọc" | `agentRules: false` + pointer docs Next trong Knowledge discovery, các file test, `Sidebar.tsx`, `agent/page.tsx` |
| `fix/ux-round-2` | theo báo cáo review-experience | TBD |
