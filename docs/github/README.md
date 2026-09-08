# Issue và Pull Request cho lộ trình v0.9

Mỗi tính năng có một nhánh (mặc định `feat/<slug>`; dòng 2 của issue có thể ghi `branch: fix/<slug>` hoặc `chore/<slug>`), một issue (`issues/<slug>.md`: dòng đầu là tiêu đề) và một PR (`prs/<nhánh với "/" → "-">.md` theo `PR_TEMPLATE.md`, có `Closes #<n>` để script điền số issue). Nhãn phiên bản qua `RELEASE_LABEL` (mặc định `v0.11`). **Luôn truyền danh sách slug của đợt hiện tại** — chạy không tham số sẽ duyệt cả slug của các đợt cũ (issue đã đóng nên script sẽ tạo trùng).

Tạo trên GitHub (chỉ cần token có scope `repo`; script tự push nhánh bằng token, không cần git credential):

```bash
GH_TOKEN=ghp_xxx scripts/github-open-issues-prs.sh restricted-zones speaker-announce agent-feedback corrective-actions agent-ops-alert-channels engine-requirements   # đợt v0.11
GH_TOKEN=ghp_xxx scripts/github-open-issues-prs.sh zone-roi    # một slug
INTEGRATION_BRANCH=integration/v0.9 GH_TOKEN=ghp_xxx scripts/github-open-issues-prs.sh   # thêm PR tổng (prs/integration-v0.9.md)
```

Script không tạo trùng: issue mở cùng tiêu đề hoặc PR mở cùng nhánh sẽ được dùng lại. Thứ tự gộp khuyến nghị (tránh xung đột `ai-engine/yolo_inference.py`, `CHANGELOG.md`): `zone-roi` → `alert-channels` → `admin-completion` → `mobile-pwa` → `reports` → `compliance-observations` → `evidence-clips` → `violation-heatmap` → `postgres-multi-worker`; hoặc gộp nhánh `integration/v0.9` (đã gộp sẵn theo thứ tự đó, đã kiểm tra) vào `main`.

Lưu ý: chưa push `main` cục bộ trước khi các PR được gộp — `main` cục bộ đã chứa toàn bộ v0.9, nếu push trước thì các PR sẽ không còn diff (GitHub trả 422 "no commits").
