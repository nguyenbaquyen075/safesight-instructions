---
profile: release
scope: worktree
source_kind: working-tree
head_sha: 7e70997160d048365eaaa68bb1e729002eb329c0
dirty: false
tree_digest: 996e1856b641ad632ac8cc8942ec3a27cba904ac
run_id: 9gtjj8
reviewed_at: 2026-09-08T16:07:16+07:00
---

# Release review — safesight-instructions @ 7e70997 (clean)

Objective: second pass after the operator asked for fresh `change` + `health` evidence (first pass: `2026-09-08-release-worktree-50dwj6.md`, verdict CONTINUE BUILDING). Product direction unchanged: v0.10.0 is a presentation release for the lecturer; "done" = stable and documented.

## Coverage

| Profile | Status | Reason / distance |
|---|---|---|
| change | stale | latest `2026-09-08-change-692cdba-4de9402-*.md` (fix wave) at `4de9402`, 1 commit behind head — the commit that adds the report itself; preceding `…-3932209-58be986-3cg2si.md` at `58be986`, 3 behind |
| experience | never-ran | operator accepted the gap in the first pass |
| health | stale | `2026-09-08-health-worktree-5j23v0.md` at `58be986`, 3 commits behind (review-docs commit, fix commit, review-docs commit) |
| strategy | ran | inline, evidence limited to `docs/review/` + git metadata |

## Verdict

**CONTINUE BUILDING → operator override: cut v0.10.0.** `SHIP` fails gate 2 only: no consulted report can be fresh because reports are committed into the repo, so head is always at least one commit past the newest report. Every other gate holds: 2 of 3 profiles present; no open blocker in any consulted report; no carried blocker (the five from the 2026-09-07 reports were declared fixed by the operator in the first pass and the health/change runs at 58be986 list none of them); every gap explicitly acknowledged by the operator in this conversation.

## Reasoning

- The change lane at 58be986 found one high defect in the new code (`code/agent-tools/list-camera-agents-status-case-mismatch`) and one medium boundary leak (`code/agent-toolsets/orchestration-tools-leak-into-subject-bound-sessions`); the fix-wave report at 4de9402 records both closed with tests, verified by an independent correctness pass.
- The health lane found no blocker: the highs are the engine's raw-SQLite read path (`arch/ai-engine/raw-sqlite-bypasses-data-layer` — documented as a SQLite-only demo constraint), Prisma-7 transitive advisories (`deps/runtime/prisma-transitive-highs` — off the request path, waits for Prisma 8) and one stale wiki row, already corrected in 4de9402.
- No key recurs across three runs; the two 2026-09-07 blockers on auth/deps do not reappear at 58be986.

## Next actions

1. Cut v0.10.0 now (CHANGELOG, wiki/10, package version, tag) — done in the same commit as this report.
2. For v0.11: unify the agent escalation path with `alert-channels` (`arch/agent/parallel-notification-path`) and move the engine's camera/zone reads behind the HTTP boundary (`arch/ai-engine/raw-sqlite-bypasses-data-layer`).
3. Add `ai-engine/requirements.txt` and run `/review-experience` once the machine can host the app (`deps/python/no-requirements-lockfile`, experience gap).

## Carried blockers (not re-verified)

None open. The five carried in the first pass were cleared by the operator's statement and are absent from the runs at 58be986.

## Acknowledged gaps

- `experience` never ran — operator accepted (first pass).
- `health` 3 commits and `change` 1 commit behind head (docs/fix commits) — operator accepted and asked to cut v0.10.0.
