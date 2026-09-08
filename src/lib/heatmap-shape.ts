// SPDX-License-Identifier: MIT
import type { BoundingBox } from '@/types/models';

// Phần thuần cho /analytics (F7): TimeHeatmap và PositionHeatmap chỉ vẽ, không tự
// gộp dữ liệu -> tách ra đây để test được mà không cần render React.

/**
 * Đếm số vi phạm theo (thứ trong tuần, giờ) dựa trên `detectedAt`, dùng giờ địa
 * phương trình duyệt (khớp cách ComplianceChart hiển thị ngày). Hàng 0 = Chủ nhật,
 * khớp `Date.getDay()`. Bỏ qua các dòng có `detectedAt` không parse được.
 */
export function hourWeekdayGrid(rows: { detectedAt: string }[]): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const row of rows) {
    const d = new Date(row.detectedAt);
    if (Number.isNaN(d.getTime())) continue;
    grid[d.getDay()][d.getHours()] += 1;
  }
  return grid;
}

/**
 * Tâm từng bbox (tỉ lệ 0-1 của khung hình, khớp cách yolo_inference.py ghi
 * `bboxData`) kèm loại vi phạm, để PositionHeatmap vẽ chấm mờ lên ảnh xem trước.
 * Bỏ qua bbox thiếu/hỏng số liệu thay vì làm vỡ cả trang.
 */
export function bboxCenters(
  rows: { bboxData: BoundingBox[]; type: string }[],
): { x: number; y: number; type: string }[] {
  const centers: { x: number; y: number; type: string }[] = [];
  for (const row of rows) {
    if (!Array.isArray(row.bboxData)) continue;
    for (const box of row.bboxData) {
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      centers.push({ x, y, type: row.type });
    }
  }
  return centers;
}

/** Giá trị lớn nhất trong lưới giờ×thứ, dùng để chuẩn hoá alpha (ô nóng nhất = đậm nhất). */
export function maxCell(grid: number[][]): number {
  let max = 0;
  for (const row of grid) for (const v of row) if (v > max) max = v;
  return max;
}
