// SPDX-License-Identifier: MIT

import { useState, useEffect, useRef, useCallback } from 'react';
import { speakVietnamese } from '@/lib/speak';

const INTERVAL_MS = 2000;     // nhịp kiểm tra / khoảng cách giữa 2 camera trong cùng một vòng
const ROUND_GAP_MS = 10000;   // nghỉ giữa 2 vòng, để người ở hiện trường kịp khắc phục

export interface SpokenItem {
  key: string;   // mã camera: mỗi vòng mỗi camera đọc đúng 1 lần
  text: string;
}

/**
 * Khi `enabled`, hook hỏi `getMessages()` (các lỗi hệ thống đang bắt được) và đọc to theo VÒNG:
 * mỗi camera đang lỗi đọc đúng 1 lần, cách nhau 2 giây; hết vòng thì nghỉ 10 giây rồi lặp lại.
 * Camera hết lỗi thì tự rơi khỏi vòng sau; camera mới lỗi xuất hiện thì vào vòng đang chạy
 * (hoặc vòng kế tiếp nếu đang nghỉ). Hết lỗi thì tự im.
 * Câu trước chưa đọc xong thì chờ, không dồn hàng đợi.
 * `speak` dùng trong chính thao tác bấm nút bật loa — vừa mở quyền phát âm của trình duyệt,
 * vừa đọc câu xác nhận để người dùng nghe được ngay là loa đã hoạt động.
 */
export function useAutoSpeaker(enabled: boolean, getMessages: () => SpokenItem[]) {
  const [error, setError] = useState<string | null>(null);
  const getRef = useRef(getMessages);
  const announcedRef = useRef(new Set<string>());   // camera đã đọc trong vòng hiện tại
  const restUntilRef = useRef(0);

  useEffect(() => {
    getRef.current = getMessages;
  });

  // Chrome chỉ nạp danh sách giọng sau lần gọi getVoices() đầu tiên — gọi sớm cho kịp lúc bấm.
  useEffect(() => {
    window.speechSynthesis?.getVoices();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const announced = announcedRef.current;
    announced.clear();
    restUntilRef.current = 0;
    const timer = setInterval(() => {
      if (Date.now() < restUntilRef.current) return;
      if (window.speechSynthesis?.speaking) return;
      const items = getRef.current();
      const item = items.find((it) => !announced.has(it.key));
      if (!item) return;
      setError(speakVietnamese(item.text));
      announced.add(item.key);
      // Vừa đọc camera cuối của vòng -> nghỉ 10 giây rồi bắt đầu vòng mới
      if (items.every((it) => announced.has(it.key))) {
        announced.clear();
        restUntilRef.current = Date.now() + ROUND_GAP_MS;
      }
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled]);

  const speak = useCallback((text: string) => setError(speakVietnamese(text)), []);

  return { error, speak };
}
