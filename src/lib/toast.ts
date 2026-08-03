// SPDX-License-Identifier: MIT

// Toast siêu nhẹ, không cần Provider: bắn CustomEvent, <Toaster/> ở layout lắng nghe.
export type ToastKind = 'success' | 'info' | 'error';

export function toast(message: string, kind: ToastKind = 'info') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, kind } }));
}
