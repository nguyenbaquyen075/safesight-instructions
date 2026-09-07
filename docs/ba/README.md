# Bộ tài liệu nghiệp vụ (BA) — SafeSight

> Cập nhật 2026-09-07 theo hiện trạng mã nguồn `main` v0.6.0. Thay thế `SPEC.md` cũ.
> Nguồn sự thật: `prisma/schema.prisma`, `src/lib/auth/permissions.ts`, `src/app/`, `agent/`, `ai-engine/`, `wiki/`.

Bộ tài liệu này bàn giao đủ **15 sản phẩm BA** theo chuẩn nội bộ của team, cộng thêm bộ tài liệu dự án phải duy trì (SRS, URD, BRD, HDSD, biên bản họp). Mức chi tiết co giãn theo phạm vi, danh sách sản phẩm thì không.

## 15 sản phẩm bắt buộc

| # | Sản phẩm | Tài liệu | Ghi chú |
|---|---|---|---|
| 1 | Sơ đồ BPMN | [01-bpmn.md](01-bpmn.md) | 3 quy trình: giám sát & xử lý vi phạm, cấu hình cảnh báo, agent trực vận hành |
| 2 | Swimlane workflow | [02-swimlane-workflow.md](02-swimlane-workflow.md) | Theo đối tượng: Vi phạm, Camera, Quy tắc cảnh báo, Câu hỏi cho agent |
| 3 | Biểu đồ trạng thái | [03-state-diagrams.md](03-state-diagrams.md) | Vi phạm, Cảnh báo, Camera, Công trường, Việc của agent; ghi rõ đối tượng < 3 trạng thái |
| 4 | Danh sách chức năng | [04-function-list.md](04-function-list.md) | Trace code · Data object · Module · Function · Size · Type · Description · Phase |
| 5 | Ma trận phân quyền | [05-permission-matrix.md](05-permission-matrix.md) | Bảng actor + ma trận O / X / O* |
| 6 | Tiêu chí UX + phân tích thiết kế | [06-ux-criteria.md](06-ux-criteria.md) | Có giao diện → áp dụng |
| 7 | Mô tả màn hình | [07-screen-specs.md](07-screen-specs.md) | Bảng trường từng màn hình, ≤ 5 trường bắt buộc |
| 8 | Sitemap | [08-sitemap.md](08-sitemap.md) | Web, menu ≤ cấp 2 |
| 9 | Sơ đồ use case | [09-use-case-diagram.md](09-use-case-diagram.md) | 4 biểu đồ, ≤ 10 use case mỗi biểu đồ |
| 10 | Sơ đồ luồng chức năng | [10-activity-diagrams.md](10-activity-diagrams.md) | Chốt vi phạm, xử lý vi phạm, review bằng agent, cảnh báo Telegram, cảnh báo giọng nói |
| 11 | Đặc tả use case | [11-use-case-specs.md](11-use-case-specs.md) | Summary + Business information |
| 12 | Use scenario | [12-use-scenarios.md](12-use-scenarios.md) | Văn tường thuật bằng ngôn ngữ người dùng |
| 13 | User story + AC | [13-user-stories.md](13-user-stories.md) | AC theo when / who / how / then |
| 14 | Yêu cầu phi chức năng | [14-nfr.md](14-nfr.md) | Bảo mật, hiệu suất, yêu cầu khác |
| 15 | Quy tắc triển khai + bộ tài liệu dự án | [15-implementation-rules.md](15-implementation-rules.md) | Quy tắc sprint, UAT, danh mục tài liệu phải duy trì |

## Bộ tài liệu dự án phải duy trì

| Tài liệu | File | Vai trò |
|---|---|---|
| BRD (tuỳ chọn) | [BRD.md](BRD.md) | Bài toán kinh doanh, mục tiêu, phạm vi, tiêu chí thành công |
| URD | [URD.md](URD.md) | Yêu cầu từ góc nhìn người dùng theo từng vai trò |
| SRS | [SRS.md](SRS.md) | Đặc tả yêu cầu phần mềm: chức năng, giao diện, dữ liệu, NFR, truy vết |
| HDSD | [HDSD.md](HDSD.md) | Hướng dẫn sử dụng theo từng vai trò |
| Biên bản họp | [meetings/](meetings/README.md) | Mẫu biên bản + nhật ký quyết định |

## Quy ước

- Hành động / use case: **Động từ + Đối tượng** ("Xử lý vi phạm", không phải "Vi phạm").
- Actor / lane: danh từ chỉ nhóm người tham gia; Hệ thống (AI Engine, Agent) có lane riêng khi tự hành động.
- Mã truy vết: `F-<MODULE>-<số>` cho chức năng, `UC-<số>` cho use case, `US-<số>` cho user story, `NFR-<số>` cho yêu cầu phi chức năng, `SCR-<số>` cho màn hình.
- Sơ đồ vẽ bằng mermaid, GitHub render trực tiếp.
- Tài liệu kỹ thuật (kiến trúc, cài đặt, API, model AI) vẫn ở [`wiki/`](../../wiki/README.md); tài liệu này chỉ mô tả nghiệp vụ và yêu cầu.
