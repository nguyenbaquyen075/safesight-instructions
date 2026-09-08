## Summary

Integration branch for the v0.11 roadmap: four features from the post-v0.10 recommendation list plus two backlog items from the health review, merged in the documented order with per-task reviews, then a whole-branch review and a fix wave.

| Order | Branch | Feature |
|---|---|---|
| 1 | `chore/engine-requirements` | Pinned Python dependencies (`ai-engine/requirements.txt`) |
| 2 | `fix/agent-ops-alert-channels` | Agent ops escalations through every configured channel (Zalo, Webhook, Telegram) |
| 3 | `feat/restricted-zones` | Restricted / suspended-load zones raise intrusion violations (engine + zone editor) |
| 4 | `feat/speaker-announce` | Automatic loudspeaker announcements from the agent and the violation modal |
| 5 | `feat/corrective-actions` | Corrective actions (CAPA) with assignee, due date, overdue escalation |
| 6 | `feat/agent-feedback` | Human feedback on agent verdicts, accuracy stats, dataset export |
| 7 | `fix/v011-final` | Fix wave from the whole-branch review (CAPA escalation key, Postgres migration table list, scrollable modal, bounded lists, mobile export row) |

## Verification

- `agent/` tests: 223+ passing after every merge (see the fix-wave commit for the final count)
- `npx tsc --noEmit`, `npx eslint .`: clean
- `python3 -m unittest ai-engine/test_zones.py`: 30/30; `py_compile` clean
- `next build`: exit 0; headless-Chrome checks at 1440 and 390 px on `/agent`, `/reports`, the violation modal (detail + "Giao xử lý" dialog + Agent tab) and `/site-speaker`
- Not exercised live: the bridge `/announce` with a real speaker client, the engine on real video with danger zones, a real LLM session using `announce`/`dispatch_to_camera`

## Merge notes

- Run `npx prisma db push` after merging (new model `CorrectiveAction`, new column `Violation.reviewFeedback`).
- Merging this PR marks the six feature PRs as merged automatically (their commits are contained here).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
