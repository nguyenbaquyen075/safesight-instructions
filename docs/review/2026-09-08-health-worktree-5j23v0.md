---
profile: health
scope: worktree
source_kind: working-tree
head_sha: 58be9862e1ab65284605f40ff2675bfd41eb748a
dirty: true
tree_digest: 8722779936f4aec0289f353368056b7cdd9ed77d
deploy_rev: null
run_id: 5j23v0
reviewed_at: 2026-09-08T15:34:14+07:00
---

# Health review — safesight-instructions @ 58be986 (dirty: `.venv/` and one review report untracked)

Objective: pre-release structural check before cutting v0.10.0 (presentation release for the lecturer). 85 commits since the last health review at `8ac3758`: three fix waves (v0.7), camera subagents (v0.8), nine roadmap features (v0.9), the floating chat widget and lead-agent orchestration.

## Coverage

| Reviewer | Status | Reason / notes |
|---|---|---|
| architecture | ran | Churn-ranked (top: `ai-engine/yolo_inference.py` 21, `Sidebar.tsx` 12, `cameras/page.tsx` 10, `ppe_tracker.py` 10, `api/violations/route.ts` 9, `agent/session.ts` 8); 0 reverts in 90 days. Read the top files, mapped edges, cycle/duplication greps. Untracked entries are a virtualenv and a review report — no code. |
| deps | ran | `npm audit --json`: 4 high (all transitive of Prisma 7.10). `pip-audit` absent and `ai-engine/` has no `requirements.txt`/lockfile → Python CVEs unauditable (coverage gap, not a finding). Dependabot unreachable (no `gh`). Bundle: `.next/static` 2.4 MB, no bloat. |
| contracts | ran (manual) | `docs-anchors.sh` / `docs-compliance.sh` absent on this machine → manual equivalents: 150 relative links (0 broken), env vars in `.env.docker.example` ↔ `process.env`/`os.environ` (clean both ways), `src/app/api` routes ↔ `wiki/05` (exact match), README/AGENTS commands ↔ `package.json` (all exist), schema ↔ `wiki/04` ↔ `src/types`, CHANGELOG claims ↔ code. `context7` unavailable. |

## Findings (ranked)

### arch/ai-engine/raw-sqlite-bypasses-data-layer
- severity: high · confidence: high
- evidence: `ai-engine/yolo_inference.py:38-62` `_open_db_readonly()` opens `prisma/dev.db` with `sqlite3.connect(mode=ro)` and returns `None` for `postgres://`; hand-written SQL at `:88` (`SELECT id, rtspUrl, status FROM Camera`), `:235`, `:266-268` (`SELECT cameraId, polygonData FROM Zone WHERE isActive = 1 AND type = 'MONITORING'`); no Postgres client in `ai-engine/`. Dashboard/agent switch to `PrismaPg` at `src/lib/prisma.ts:52-55`.
- impact: a fourth DB consumer outside Prisma; any schema rename breaks it at runtime with no compile-time or parity-test coverage. On the v0.9 Postgres path zones and real cameras silently degrade to demo video (warning at `:52` only) while the UI still offers both.
- action: (a) state in release notes and `wiki/03` that the engine requires `DATABASE_URL=file:` and demo on SQLite; or (b) serve cameras + zones over the HTTP boundary the engine already uses (`GET /api/engine/config` guarded by `X-AI-Engine-Secret`) and delete `_open_db_readonly`.

### deps/runtime/prisma-transitive-highs
- severity: high · confidence: high
- evidence: `npm audit --json` → `deepmerge-ts@7.1.5` (GHSA-ggr8-5vv4-36mx, stack exhaustion, via `@prisma/config`), `mysql2@3.15.3` (GHSA-3f6p-5ww8-9rcr auth-plugin downgrade leaks credentials; GHSA-rgwj-5xj2-c3m3 zlib DoS). Fix requires Prisma 8 (not GA); `npm audit` proposes a downgrade to 6.19.3.
- impact: keeps `npm audit` red; neither package is on the production request path (mysql2 unused — SQLite/Postgres adapters only; deepmerge-ts at config parse). Down from 27 advisories at the last review.
- action: track Prisma 8 GA; re-run audit after upgrade. Not a release blocker for a SQLite/Postgres deployment.

### docs/data-model/zone-ai-pipeline-stale
- severity: high · confidence: high
- evidence: `wiki/04-mo-hinh-du-lieu.md:26` Zone row: "`polygonData` JSON string; **chưa dùng trong pipeline AI**" vs `ai-engine/yolo_inference.py:254-280` (`load_zones()`), `:527-538` (reload every 60 s), `:602` (`process_frame(frame, zones=…)`); `wiki/05:53` and CHANGELOG `[0.9.0]` already describe the filter as shipped.
- impact: the data-model page the README points the lecturer to says a shipped v0.9 feature does nothing.
- action: update the Zone row in `wiki/04` to say it is consumed by `ai-engine/zones.py` for detection filtering; also note that `src/types/models.ts` `Zone` (with `schedule`, `maxOccupancy`) is not the shape the feature uses (`ZoneDTO` in `src/lib/zone-shape.ts`) and is unreferenced.

### arch/agent/parallel-notification-path
- severity: medium · confidence: high
- evidence: `src/lib/alert-channels/index.ts:31-38` `SENDERS` (Telegram/Zalo/Webhook) used by `src/lib/alert-notifier.ts` with threshold, cooldown and `prisma.alert.create` (`:87-101`); `agent/lib/notify.ts:17-37` re-implements rule matching and builds `TelegramClient` directly — no `senderFor`, no cooldown, no `Alert` row. Callers `agent/tools/escalate.ts:25`, `agent/direct/actions.ts:66`.
- impact: rules configured for Zalo/Webhook never receive agent escalations; escalations never appear on `/alerts`; every new channel is missing from the agent path by default.
- action: make `sendOpsAlert` iterate the rule's channels through `senderFor()` and write the `Alert` row (`agent/tools/escalate.ts:7` already imports `@/lib/alert-notifier`, so no new boundary).

### arch/cameras/roster-defined-four-times
- severity: medium · confidence: high
- evidence: `src/data/mock-cameras.ts:8` (12 cameras) drives `cameras/page.tsx:440,488`, `use-real-sites.ts:10,14`, `SiteDetailModal.tsx:18`, `site-speaker/page.tsx:24`; `src/data/camera-videos.json` (6 ids) → `DEMO_CAMERA_IDS` at `src/lib/camera-shape.ts:12` and re-read by `ai-engine/yolo_inference.py:220`; `prisma/seed.mjs:36-42` hardcodes the same 6; `CameraMonitoringCard.tsx:16` derives `DEMO_IDS` from the 12-camera mock while `api/cameras/route.ts:29` uses the 6-id set.
- impact: two definitions of "demo camera" that disagree on `cam-004/006/009–012`; dormant only because seed inserts 6.
- action: import `DEMO_CAMERA_IDS` in `CameraMonitoringCard.tsx` and delete the local set (one-line fix); optionally derive `seed.mjs` cameras from `camera-videos.json`.

### deps/python/no-requirements-lockfile
- severity: medium · confidence: medium
- evidence: no `ai-engine/requirements.txt`; README installs `ultralytics opencv-python requests` unpinned; `pip-audit` not installed.
- impact: Python CVEs and licences cannot be audited; installs are not reproducible.
- action: add a pinned `ai-engine/requirements.txt` (torch, ultralytics, opencv-python, requests) and run `pip-audit` in CI or document the gap.

## Minor observations
- architecture: `cameras/page.tsx` (770 lines, five components + page) is the top-churn `src/` god file; `parseJsonArray`/`parseArray`/`parseJsonOr` are three copies of one helper (`alert-notifier.ts:16`, `agent/lib/notify.ts:12`, `violation-shape.ts:6`); `getMockCamera`/`getCamerasBySite` in `mock-cameras.ts:28-34` are dead. Healthy: `alert-channels/*` layering, `agent/lib/db.ts` re-exporting the shared Prisma client, single `permissions.ts`, no `../../../` traversal, no import cycles.
- deps: 4 npm highs are all Prisma-7 transitive; `.next/standalone` 757 MB is the normal server build.
- contracts: env vars, API route table, build commands, Roboflow claims in AGENTS.md, CHANGELOG `[Unreleased]`/`[0.9.0]` all verified accurate; `wiki/09` toolset/priority table byte-for-byte matches `toolsets.ts`/`tasks.ts`.
