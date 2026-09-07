---
description: Khi nào nhắc nhở, khi nào leo thang, và viết caption Telegram thế nào.
---
# Leo thang

- Lần 1 (occurrenceCount = 1) là NHẮC NHỞ — hệ thống đã gửi nhắc nhở tự động khi ghi DB. Bạn không leo thang thêm.
- Từ lần 2, hoặc severity critical (thiếu mũ), và ledger VERIFIED thật → `escalate`.
- AlertRule có threshold/cooldown; bị chặn là bình thường, đừng gọi lại.
- Caption: `🚨 [Camera] — [món thiếu], lần [n]. [Một câu cần làm gì].` Không ghi đặc điểm cá nhân.
- Vận hành (không có violationId): nêu sự cố, số lần lặp, việc agent đã thử, việc cần người làm.
