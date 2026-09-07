---
name: SafeSight Dashboard
version: 1.0.0
description: Dashboard giám sát an toàn lao động, nền tối, mật độ thông tin cao, phản hồi realtime.
colors:
  primary: "#2563EB"
  primary-hover: "#1D4ED8"
  primary-light: "#3B82F6"
  primary-muted: "rgba(37, 99, 235, 0.15)"
  danger: "#DC2626"
  danger-muted: "rgba(220, 38, 38, 0.15)"
  warning: "#F59E0B"
  warning-muted: "rgba(245, 158, 11, 0.15)"
  success: "#16A34A"
  success-muted: "rgba(22, 163, 74, 0.15)"
  info: "#0EA5E9"
  info-muted: "rgba(14, 165, 233, 0.15)"
  severity-critical: "#DC2626"
  severity-high: "#EA580C"
  severity-medium: "#F59E0B"
  severity-low: "#0EA5E9"
  background: "#0F172A"
  background-secondary: "#0B1120"
  surface: "#1E293B"
  surface-hover: "#273548"
  surface-elevated: "#334155"
  border: "#334155"
  border-subtle: "#1E293B"
  text-primary: "#F8FAFC"
  text-secondary: "#94A3B8"
  text-muted: "#64748B"
typography:
  family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace"
  h1: "30px / 800"
  h2: "20px / 800"
  body: "14px / 400"
  label: "10px / 900 uppercase tracking-widest"
spacing:
  unit: 4px
  card: 20px
  section: 32px
radius:
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  card: 16px
elevation:
  sm: "0 1px 2px 0 rgba(0,0,0,0.3)"
  md: "0 4px 6px -1px rgba(0,0,0,0.3), 0 2px 4px -2px rgba(0,0,0,0.3)"
  glow-primary: "0 0 20px rgba(37,99,235,0.3)"
  glow-danger: "0 0 20px rgba(220,38,38,0.3)"
motion:
  fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)"
  base: "250ms cubic-bezier(0.4, 0, 0.2, 1)"
  enter: "animate-fade-up (translateY 8px → 0, opacity 0 → 1, 300ms)"
---

# SafeSight Dashboard — DESIGN.md

## Landing page — Industrial editorial (2026)

Bản nâng cấp theo toàn quyền thiết kế của anh: bỏ hero căn giữa và card bo góc đồng đều. Hero chia hai cột, ảnh công trường phủ khung dọc, typography sans lớn phối serif italic, nhãn kỹ thuật mono và đường kẻ mảnh. Tính năng trình bày theo lưới đánh số; quy trình dạng editorial hai cột; kiến trúc nền bản vẽ kỹ thuật. Không thêm hiệu ứng chỉ để trang trí.

Tokens bản editorial ghi đè phần landing cũ bên dưới: light background `#F3F2ED`, surface `#FAFAF7`, text `#202922`, secondary `#60685F`, border `#CDD1C7`; dark background `#141A17`, surface `#1B231E`, text `#EDF0E6`, secondary `#A8B2A5`, border `#3B473D`. Primary giữ `#2563EB`; accent light `#245CC5`, dark `#93BAFF`. Hero 56–105px, sans weight 500, serif italic 400; section 34–59px. Container 1360px, gutter 48/32/20px, section 110/80/60px. Khối và nút vuông; chỉ theme/menu và nút ảnh dùng hình tròn. Không shadow/glow. Mobile hero xếp dọc ≤600px; các tương tác và giới hạn dữ liệu giữ nguyên.

### Nền tảng và hành vi kế thừa

Phạm vi riêng: `landing-page/`, HTML/CSS/JavaScript tĩnh, giữ nguyên dashboard và các route xác thực.

- **Màu:** kế thừa primary `#2563EB`, hover `#1D4ED8`; light background `#F8FAFC`, surface `#FFFFFF`, text `#12213A`, secondary `#52627A`, border `#DCE4EE`; dark background `#0B1120`, surface `#111D30`, text `#F1F5FC`, secondary `#A5B4CB`, border `#293951`. Accent text light `#1D4ED8`, dark `#82B1FF`.
- **Typography:** system sans hỗ trợ tiếng Việt, hero 40–68px/1.12/760, section 29–42px/1.23, body 14–17px/1.65–1.8. Mono chỉ dùng cho mã và nhãn kỹ thuật.
- **Spacing:** lưới 4/8px, container 1184px, section 96px desktop/58px mobile; gutter 32px/18px.
- **Radius/elevation:** nút 9px, card 13px, khung lớn 15–20px; shadow chỉ nhấn preview, không glow trang trí.
- **Components:** header sticky, hero, preview có nhãn minh họa, feature cards, quy trình, sơ đồ kiến trúc tĩnh, CTA cài đặt, FAQ native details.
- **Theme:** mặc định theo hệ thống; lưu lựa chọn trong `safesight-theme`; áp dụng trước paint; vẫn đổi được khi storage bị chặn.
- **Motion:** hover 180ms; smooth anchor scroll; tắt với reduced-motion. Không autoplay video.
- **Responsive:** 3/2/1 cột tính năng, mobile menu ≤900px, preview co về một cột ≤600px. Không che overflow để giấu lỗi layout.
- **Accessibility:** focus ring rõ, icon SVG có aria-hidden, nút icon có nhãn, hit target ≥44px, skip link, trạng thái menu/theme qua ARIA.
- **Rationale:** màu xanh giữ nhận diện và niềm tin kỹ thuật; khoảng trắng và preview thay cho số liệu quảng cáo. Ảnh trích từ video mẫu local; overlay minh họa được ghi rõ, không mô tả là inference thật. Giữ trung thực trạng thái MVP và các tích hợp cloud tùy chọn.

## Vì sao trông như vậy
Dashboard chạy 24/7 trong phòng trực, nền tối để đỡ mỏi mắt và để khung đỏ vi phạm nổi bật.
Màu ngữ nghĩa cố định: đỏ = vi phạm/nguy hiểm, vàng = cảnh báo/chờ, xanh lá = an toàn/đã xử lý,
xanh dương = hành động chính. Không dùng màu khác cho các ý này.

## Thành phần dùng chung
- `SectionHeader`, `SettingCard`, `InputGroup`, `Switch` trong `src/components/settings/ui.tsx` — mọi
  form/cài đặt mới dùng lại, không tự vẽ.
- Card: nền `surface`, viền `border`, bo `radius.card`, đệm `spacing.card`.
- Nhãn nhỏ (`label`) chữ HOA, `text-muted`; số liệu lớn `font-black`.
- Nút chính: nền `primary`, chữ trắng, hover `primary-hover`, `glow-primary` khi là hành động quan trọng.

## Thành phần Agent (mới)
- **Băng band**: `VERIFIED` = `success` (báo oan) hoặc `danger` (vi phạm thật); `PROBABLE` = `warning`;
  `POSSIBLE` = `info`; chưa review = `text-muted` với chữ "Chưa review".
- **Observation chip**: viền `border`, chữ `text-secondary`, 10px, tiếng Việt từ `WEIGHTS[kind].label`.
- **Dòng thời gian AgentEvent**: mỗi dòng có icon theo `type` (tool.call = Terminal, verdict = ShieldCheck/ShieldAlert,
  action = Zap, health = Activity, error = AlertCircle, message = MessageSquare), giờ `HH:mm:ss` mono.
- **Ô hỏi đáp**: textarea + nút gửi; khi phiên đang chạy hiện "Agent đang trả lời…" và poll 2s; im lặng 90s coi là xong.
- **Trạng thái rỗng/tải/lỗi** bắt buộc cho mọi khối: "Chưa có gì", skeleton `surface-elevated`, thông báo lỗi `danger-muted`.

## Responsive
- Lưới `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` cho thẻ số; bảng/dòng thời gian cuộn ngang trong container `overflow-x-auto`.
- Không bao giờ để trang cuộn ngang; văn bản dài `break-words`.
- Ghi chú: layout hiện có sidebar cố định 260px chưa responsive (việc riêng, ngoài plan này).

## Trợ năng
- Mọi nút icon có `aria-label`; focus ring `ring-2 ring-[var(--primary)]`.
- Tương phản chữ trên `surface` ≥ 4.5:1 (đã đạt với `text-primary`/`text-secondary`).
