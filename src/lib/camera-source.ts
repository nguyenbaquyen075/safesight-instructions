// SPDX-License-Identifier: MIT

// Quy ước lưu nguồn video của camera THẬT vào field rtspUrl (khỏi phải đổi schema DB):
//   "webcam:0"    -> webcam theo index 0 (thử 1, 2... nếu máy có nhiều webcam)
//   "rtsp://..."  -> camera IP thật qua RTSP
// yolo_inference.py đọc đúng field này (qua get_video_source()) để biết cam nào
// dùng nguồn sống thay vì video demo — xem CAMERA_SOURCE_OVERRIDES cũ đã bỏ.
export function isValidCameraSource(source: string): boolean {
  return /^webcam:\d+$/.test(source) || source.startsWith('rtsp://');
}

export function parseCameraSource(source: string): { type: 'webcam'; index: number } | { type: 'rtsp'; url: string } | { type: 'unknown' } {
  const webcamMatch = source.match(/^webcam:(\d+)$/);
  if (webcamMatch) return { type: 'webcam', index: Number(webcamMatch[1]) };
  if (source.startsWith('rtsp://')) return { type: 'rtsp', url: source };
  return { type: 'unknown' };
}
