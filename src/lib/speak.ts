// SPDX-License-Identifier: MIT

/**
 * Đọc to một câu tiếng Việt bằng giọng của trình duyệt (speechSynthesis).
 * Trả về thông báo lỗi tiếng Việt để hiện cho người dùng, hoặc null nếu đã đọc.
 *
 * ponytail: xếp hàng nối đuôi thay vì cancel, để nhiều camera cùng báo không cắt lời nhau.
 * Bridge đã chờ 30s giữa 2 lần đọc/camera nên hàng đợi không dài; nếu sau này có hàng
 * dồn ứ thì bỏ bớt câu cũ ở đây.
 */
export function speakVietnamese(text: string): string | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return 'Trình duyệt này không hỗ trợ đọc giọng nói.';
  }
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('vi'));
  if (!voice) {
    return 'Máy này chưa có giọng tiếng Việt (vi-VN) — cài giọng trong cài đặt hệ thống rồi tải lại trang.';
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  window.speechSynthesis.speak(utterance);
  return null;
}
