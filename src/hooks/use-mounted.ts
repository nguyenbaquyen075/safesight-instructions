// SPDX-License-Identifier: MIT

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * false khi render trên server / lúc hydrate, true ngay sau đó trên client.
 * Thay cho cặp `useState(false)` + `useEffect(() => setMounted(true), [])` — cùng
 * kết quả hiển thị nhưng không setState trong effect (rule react-hooks/set-state-in-effect).
 * Dùng cho trang đọc localStorage / cần tránh lệch hydrate.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
