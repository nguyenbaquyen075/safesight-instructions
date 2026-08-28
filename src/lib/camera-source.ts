// SPDX-License-Identifier: MIT

// Quy ước lưu nguồn video của camera vào field rtspUrl (khỏi phải đổi schema DB):
//   "webcam:0"     -> webcam theo index 0 (thử 1, 2... nếu máy có nhiều webcam)
//   "rtsp://..."   -> camera IP thật qua RTSP
//   "video:ten.mp4" -> video mẫu trong public/videos/ (camera mô phỏng)
// yolo_inference.py đọc đúng field này (qua get_video_source()) để biết cam nào
// dùng nguồn nào — xem CAMERA_SOURCE_OVERRIDES cũ đã bỏ.
//
// Loại "video:" thêm 24/08/2026: trước đó camera demo bị khoá cứng vào
// src/data/camera-videos.json, muốn đổi video phải sửa file rồi khởi động lại.
// Giờ chọn thẳng trong giao diện. File json cũ vẫn đọc được để không vỡ dữ liệu cũ.

/** Tên file video hợp lệ: không có dấu / hay .. để không thoát khỏi public/videos. */
export function isSafeVideoName(name: string): boolean {
  return /^[\w.\- ]+\.(mp4|mov|webm|avi|mkv)$/i.test(name) && !name.includes('..');
}

export function isValidCameraSource(source: string): boolean {
  if (source.startsWith('video:')) return isSafeVideoName(source.slice(6));
  return /^webcam:\d+$/.test(source) || source.startsWith('rtsp://');
}

export type CameraSource =
  | { type: 'webcam'; index: number }
  | { type: 'rtsp'; url: string }
  | { type: 'video'; file: string }
  | { type: 'unknown' };

export function parseCameraSource(source: string): CameraSource {
  const webcamMatch = source.match(/^webcam:(\d+)$/);
  if (webcamMatch) return { type: 'webcam', index: Number(webcamMatch[1]) };
  if (source.startsWith('rtsp://')) return { type: 'rtsp', url: source };
  if (source.startsWith('video:')) {
    const file = source.slice(6);
    if (isSafeVideoName(file)) return { type: 'video', file };
  }
  return { type: 'unknown' };
}
