## Summary

Integration branch for the v0.9 roadmap. It merges the nine feature branches in the documented order and adds the fix wave from the final review, so it can be merged into `main` as one unit instead of nine conflicting PRs.

Feature PRs (kept open for per-feature review; each closes its issue):

| Order | Branch | Feature |
|---|---|---|
| 1 | `feat/zone-roi` | Danger zones / ROI per camera (F1) |
| 2 | `feat/alert-channels` | Zalo OA + webhook alert channels (F2) |
| 3 | `feat/admin-completion` | User management, password change, audit log (F3) |
| 4 | `feat/mobile-pwa` | PWA manifest, service worker, mobile sidebar (F4) |
| 5 | `feat/reports` | Violation reports page with print/CSV (F5) |
| 6 | `feat/compliance-observations` | Compliance observations and compliance rate stats (F6) |
| 7 | `feat/evidence-clips` | Evidence clips around each violation (F7) |
| 8 | `feat/violation-heatmap` | Time and position heatmaps (F8) |
| 9 | `feat/postgres-multi-worker` | Postgres schema parity, migration script, multi-worker (F9) |

Fix wave from the final review (`fix/v09-engine`, `fix/v09-api-security`, `fix/v09-ui`): engine refuses to silently degrade when `DATABASE_URL` is Postgres, only SUPER_ADMIN may assign SUPER_ADMIN, unique clip filenames, webhook SSRF guard (private addresses, manual redirects, https only), audit-log coverage, zones PUT authorization, service-worker caching, bounded frame ring memory, non-blocking observation POST, batched upserts, sidebar collapsed on mobile.

## Verification

- `agent/` tests: 168/168 passing
- `npx tsc --noEmit` and `npm run lint`: clean
- `ai-engine` unittest: 19/19 passing
- `next build`: exit 0
- Not verified in this branch: browser UI walkthrough and the engine on live video (the machine was under load); tracked in the follow-up checklist in `docs/superpowers/plans/2026-09-08-roadmap-features.md`.

## Merge notes

- Run `npx prisma db push` after merging (new models: `CameraAgent`, `ZaloSettings`, `ObservationStat`; new columns on `Violation` and `AgentSettings`).
- Merging this PR makes the nine feature PRs show as merged automatically because their commits are contained here.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
