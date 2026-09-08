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
