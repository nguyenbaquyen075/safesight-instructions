// SPDX-License-Identifier: MIT

import { useSyncExternalStore } from 'react';

export const READ_ALERTS_KEY = 'safesight_read_alerts';
// Bắn khi ghi trong cùng tab — sự kiện `storage` gốc của trình duyệt chỉ nổ ở
// các tab/document khác, không nổ ở chính tab vừa setItem.
const CHANGE_EVENT = 'safesight-read-alerts-change';

const EMPTY: Set<string> = new Set();
let cache: { raw: string | null; ids: Set<string> } | null = null;

function readSnapshot(): Set<string> {
  const raw = localStorage.getItem(READ_ALERTS_KEY);
  if (cache && cache.raw === raw) return cache.ids;
  let ids: Set<string>;
  try {
    ids = new Set(JSON.parse(raw || '[]'));
  } catch {
    ids = new Set();
  }
  cache = { raw, ids };
  return ids;
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

/**
 * Id các thông báo đã đọc (nguồn: localStorage, ghi bởi alerts/page.tsx qua
 * persistReadAlertIds). Tách thành hook dùng chung để nơi khác (vd. badge
 * "Thông báo" ở Sidebar) có thể trừ đi các id đã đọc và luôn khớp với
 * /alerts — kể cả khi thay đổi diễn ra trong cùng tab.
 */
export function useReadAlertIds(): Set<string> {
  return useSyncExternalStore(subscribe, readSnapshot, () => EMPTY);
}

/** Ghi lại danh sách id đã đọc và báo cho mọi nơi đang dùng useReadAlertIds(). */
export function persistReadAlertIds(ids: Set<string>) {
  localStorage.setItem(READ_ALERTS_KEY, JSON.stringify(Array.from(ids)));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
