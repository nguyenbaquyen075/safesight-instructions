---
profile: health
scope: worktree
source_kind: working-tree
head_sha: 8ac3758161810af4e5afb45a4519c3fb8f226506
dirty: true
tree_digest: 3bd93f9a06a91d4a615875e3b9c7a5eaf67f05c4
deploy_rev: null
run_id: c3clm7
reviewed_at: 2026-09-07T18:42:02+07:00
---

# Health review — safesight-instructions @ 8ac3758 (dirty)

Objective: first structural review after merging the autonomous agent (`agent/`), Docker/CI/release setup and the BA document set; input for the fix list before the next release.

## Coverage

| Reviewer | Status | Reason / notes |
|---|---|---|
| architecture | ran | Churn-ranked (66 commits / 90 days, 0 reverts); read top churn files, Docker/compose, workflows, landing-page (untracked, read-only). Not read: full `agent/` tree, wiki, BA docs, schema. |
| deps | ran | `npm audit --json` exit 1 (27 advisories: 3 critical, 16 high, 6 moderate, 2 low). Dependabot unreachable (no `gh`, no token). Python stack: no lockfile → not auditable. |
| contracts | ran (manual) | `docs-anchors.sh`, `docs-compliance.sh`, `context7` unavailable on this machine; manual checks of README, AGENTS, CHANGELOG, DESIGN, wiki 02/04/05/09, BA SRS/05/08/01/04/06/10/11, `.env.docker.example`, compose, workflows, package.json scripts, schema ↔ `src/types/models.ts`, `PAGE_ROLES`, env vars in src/agent/ai-engine. |

Dirty files (`DESIGN.md`, `landing-page/*`, `wiki/05`) belong to a concurrent session and were reviewed read-only.

## Findings (ranked)

### arch/deployment/state-split-across-container-boundary
- severity: **blocker** · confidence: high
- evidence: `docker-compose.yml:1` ("AI engine … và agent chạy ngoài container"); dashboard uses named volume `safesight-data:/app/data` with `DATABASE_URL=file:./data/dev.db`; `Dockerfile:27` bakes `public/` at build (no snapshot mount); `ai-engine/yolo_inference.py:23` `SNAPSHOT_DIR = "public/snapshots"` and `:25-38` opens `DATABASE_URL` as a local SQLite file; `agent/lib/db.ts:3` → `src/lib/prisma.ts:15` same local-file assumption; `agent/tools/record_verdict.ts:26`, `agent/direct/actions.ts:19` write to that DB.
- impact: anyone deploying with compose. Three processes share file state (SQLite + `public/snapshots`) but only two are containerized: the engine cannot read camera config the dashboard wrote, the agent cannot write verdicts/camera status into the DB the dashboard serves, snapshots written by the engine are never served. The stack starts "healthy" on two different databases.
- action: bind-mount host paths (`./data:/app/data`, `./public/snapshots:/app/public/snapshots`) and document that engine/agent must use the same host `./data/dev.db`; or give engine/agent an HTTP/DB-URL boundary. Decide before release; do not ship compose as-is.

### deps/auth/next-auth-and-auth-core-critical
- severity: **blocker** · confidence: high
- evidence: `npm audit`: `next-auth 5.0.0-beta.31` (package.json `^5.0.0-beta.31`) critical — GHSA-7f8j-9c84-2pf7 (existence-based auth checks fail open on config error), GHSA-7rqj-j65f-68wh (email normalizer homoglyph `@` bypass, `@auth/core` 0.41.2 < 0.41.3); `@auth/prisma-adapter 2.11.2` pulls the vulnerable `@auth/core`.
- impact: authentication library with two critical advisories in production path; beta line in production.
- action: upgrade `next-auth`, `@auth/core` (≥ 0.41.3) and `@auth/prisma-adapter` together to the first versions that resolve the fixed core; re-run `npm audit`.

### arch/violations/dual-store-localstorage-vs-db
- severity: high · confidence: high
- evidence: server store `src/app/api/violations/route.ts:11`, `src/hooks/use-violations.ts:22`, `src/app/(dashboard)/violations/page.tsx:56`; browser store `src/app/(dashboard)/cameras/page.tsx:476` (`safesight_alerts`), `:455` (`safesight_recorded_violations`), `:211` read back; `src/app/(dashboard)/sites/page.tsx:216-217` writes a "site created" record into the same key; `src/components/layout/Sidebar.tsx:62-64` `setAlertCount(11 + customAlerts.length)`.
- impact: one violation has two homes that already drift: the sidebar badge is per-browser with a hardcoded baseline of 11 and can never agree with the violations page; every new violation feature must be written twice.
- action: make the DB the single store — cameras page POSTs to `/api/violations`, sidebar badge reads `useViolations()`, move the sites notice off the `safesight_alerts` key.

### deps/runtime/socket-engine-dos-chain
- severity: high · confidence: high
- evidence: `engine.io 6.6.6` — GHSA-w625-4p8l-v7jq polling transport connection exhaustion, WebTransport SID DoS; `socket.io 4.8.3` depends on it.
- impact: connection exhaustion / DoS on the bridge and dashboard socket server.
- action: upgrade `engine.io` ≥ 6.6.8 via `socket.io` update; re-run audit.

### deps/transitive/high-advisories-group
- severity: high · confidence: high
- evidence: `hono 4.12.14` (via `@prisma/dev`) — 4 highs incl. GHSA-8978-wrx4-w9qp, GHSA-fc7w-mh72-5g66, GHSA-88fw-hqm2-52qc; `js-yaml 4.1.1` GHSA-6qvf-qg6g-h772 (merge-key DoS); `brace-expansion 1.1.14` exponential expansion; `browserslist 4.28.2` unbounded memory.
- impact: mostly build/dev-time transitive paths; low runtime exposure but they keep `npm audit` red and CI noisy.
- action: `npm audit fix` where non-breaking; bump `prisma` for hono; verify lockfile diff.

### arch/ppe-tracker/god-method-process-frame
- severity: medium · confidence: high
- evidence: `ai-engine/ppe_tracker.py:285-681` one ~396-line method with six nested defs; churn #4 (7 commits) and repair traffic #2 (4 fix commits: 9ae87d7, 03edf38, 257af75, …).
- impact: whoever tunes PPE detection next re-enters the same 400 lines; nested closures untestable in isolation.
- action: lift geometry closures next to the existing staticmethods, extract the per-class "is this PPE missing" decision so `sweep_threshold.py` can exercise it directly.

### docs/schema/violation-occurrencecount-not-exposed
- severity: medium · confidence: high
- evidence: `wiki/04-mo-hinh-du-lieu.md:28` and `docs/ba/11-use-case-specs.md:16` describe `occurrenceCount` as part of the readable Violation entity; `prisma/schema.prisma:105` has it; `src/app/api/violations/route.ts` GET mapping, `src/app/api/violations/[id]/route.ts` GET and `src/types/models.ts:87-105` omit it (only POST writes it, `alert-notifier.ts` reads the raw Prisma object).
- impact: a UI feature showing "lần thứ mấy" cannot be built from the read API as the docs imply.
- action: add `occurrenceCount` to both GET mappings and the `Violation` interface (preferred), or caveat the docs.

## Minor observations
- architecture: `cameras/page.tsx` (770 lines, churn #3, 4 fixes) has four reasons to change and a hand-synced constant `TOC_DO_PHAT = 0.75` duplicated at `ai-engine/yolo_inference.py:257`; demo roster still from `src/data/mock-cameras.ts` in parallel with DB across 6 call sites; recording effect at `page.tsx:440` iterates mock cameras only; `agent/` is well-bounded, no import cycles anywhere; landing page re-declares design tokens from `globals.css`.
- deps: version skew only in dev toolchain (json5, eslint-visitor-keys); no copyleft or missing licenses; bundle size not measured.
- contracts: `PAGE_ROLES` matches the BA permission matrix row-for-row; all env vars read in code are documented; `CONFIRM_CONF=0.6`/`CONFIRM_DELAY=3.0` match every doc claim; sitemap matches the 12 routes and 5 settings tabs; workflow files exist as CHANGELOG claims; landing-page dirty files match their new DESIGN/wiki sections.
