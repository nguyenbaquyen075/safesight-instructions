// SPDX-License-Identifier: MIT

import { useEffect } from 'react';

/**
 * Khoá cuộn của TRANG NỀN trong lúc một cửa sổ (modal) đang mở. Không khoá thì cuộn chuột trong cửa sổ
 * (hoặc trên vùng nền tối) làm trang phía sau chạy lên xuống: vùng cuộn bên trong chạm đầu/cuối thì
 * cú cuộn "tràn" sang trang nền. Giữ nguyên vị trí cuộn của trang và bù bề rộng thanh cuộn để nội dung
 * không bị giật ngang khi khoá/mở.
 */
export function useLockBodyScroll(active = true) {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const body = document.body;
    const prev = { html: html.style.overflow, body: body.style.overflow, pad: body.style.paddingRight };
    const scrollbar = window.innerWidth - html.clientWidth;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      html.style.overflow = prev.html;
      body.style.overflow = prev.body;
      body.style.paddingRight = prev.pad;
    };
  }, [active]);
}
