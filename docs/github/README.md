# Issue và Pull Request cho lộ trình v0.9

Mỗi tính năng có một nhánh `feat/<slug>`, một issue (`issues/<slug>.md`: dòng đầu là tiêu đề) và một PR (`prs/feat-<slug>.md` theo `PR_TEMPLATE.md`, có `Closes #<n>` để script điền số issue).

Tạo trên GitHub (cần token có scope `repo`, và git credential để push nhánh):

```bash
GH_TOKEN=ghp_xxx scripts/github-open-issues-prs.sh            # tất cả slug có trong issues/
GH_TOKEN=ghp_xxx scripts/github-open-issues-prs.sh zone-roi    # một slug
```

Script không tạo trùng: issue mở cùng tiêu đề hoặc PR mở cùng nhánh sẽ được dùng lại. Thứ tự gộp khuyến nghị (tránh xung đột `ai-engine/yolo_inference.py`, `CHANGELOG.md`): `zone-roi` → `alert-channels` → `admin-completion` → `mobile-pwa` → `reports` → `compliance-observations` → `evidence-clips` → `violation-heatmap` → `postgres-multi-worker`; hoặc gộp nhánh `integration/v0.9` (đã gộp sẵn theo thứ tự đó, đã kiểm tra) vào `main`.
