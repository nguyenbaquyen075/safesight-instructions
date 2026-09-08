# Chín tính năng lộ trình v0.9 — kế hoạch

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Mỗi task = một nhánh `feat/<slug>` = một PR = một issue GitHub.

**Spec:** `docs/superpowers/specs/2026-09-08-roadmap-features-design.md` (mục F1–F9 là yêu cầu chi tiết của từng task).

## Global Constraints
- Không chạy `npm run dev`/server/Chrome trên máy vận hành; kiểm bằng `npm run test:agent` (`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="Đồng ý, chạy db push trên agent-test.db"`), `npx tsc --noEmit`, `npx eslint .`, `python3 -m py_compile` / `python3 -m unittest` cho Python; chạy tuần tự.
- Không thêm dependency npm/pip (F2 dùng `sharp` đã có để tạo icon một lần; F5 chỉ dùng `fetch`/`crypto`).
- Định danh, test title, commit tiếng Anh; UI copy, comment, tài liệu tiếng Việt; tài liệu cùng commit.
- Thứ tự gộp: đợt 1 (F1, F5, F8) → `integration/v0.9`; đợt 2 (F2, F4, F6) từ integration; đợt 3 (F3, F7, F9) từ integration. Nhánh nào đụng `ai-engine/yolo_inference.py` (F1, F3, F6) phải giữ diff nhỏ, không đổi logic nhận diện.
- Mỗi PR: mô tả theo `docs/github/PR_TEMPLATE.md`, đóng issue tương ứng (`Closes #n`), kết thúc bằng `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Tasks
| Task | Nhánh | Spec | Test tối thiểu | Commit subject |
|---|---|---|---|---|
| T1 | `feat/zone-roi` | F1 | `ai-engine/test_zones.py` (point-in-polygon, lọc người), `agent/test/zones-shape.test.ts` (zod/serialize thuần) | `feat(zones): per-camera work-zone polygons filter detections` |
| T2 | `feat/mobile-pwa` | F2 | tsc/eslint; kiểm hình ảnh hoãn | `feat(ui): responsive drawer layout and PWA manifest` |
| T3 | `feat/evidence-clips` | F3 | `agent/test/violation-shape` cập nhật `clipUrl`; `ai-engine/test_clips.py` cho ring buffer thuần | `feat(evidence): record a short clip per confirmed violation` |
| T4 | `feat/reports` | F4 | `agent/test/weekly-report.test.ts` (lịch `weeklyReportAt` → dueAt), where-builder báo cáo thuần | `feat(reports): reports page with CSV/print and the agent weekly report` |
| T5 | `feat/alert-channels` | F5 | `agent/test/alert-channels.test.ts` (chọn sender theo kênh, chữ ký webhook HMAC, escape) | `feat(alerts): Zalo OA and signed webhook channels` |
| T6 | `feat/compliance-observations` | F6 | `agent/test/compliance.test.ts` (tính rate từ ObservationStat + Violation) | `feat(stats): compliance rate from observed person-minutes` |
| T7 | `feat/violation-heatmap` | F7 | hàm gộp giờ×thứ và toạ độ bbox thuần có test | `feat(analytics): violation heatmaps by time and position` |
| T8 | `feat/admin-completion` | F8 | `agent/test/audit-log.test.ts` (logAudit ghi đúng), zod tạo user | `feat(admin): user creation, password change and audit log` |
| T9 | `feat/postgres-multi-worker` | F9 | test SQLite hiện có xanh; `rememberCamera` optimistic test | `feat(db): PostgreSQL adapter selection and multi-worker safe memory` |

Mỗi task: đọc spec mục tương ứng → TDD → docs cùng commit → `git diff` review → commit → báo cáo `scratchpad/sdd-v09/<task>-report.md`.
