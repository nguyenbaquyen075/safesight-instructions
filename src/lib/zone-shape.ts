// SPDX-License-Identifier: MIT

import { z } from 'zod';

// DB lưu type chữ HOA (khớp default trong schema.prisma và câu SQL của
// ai-engine/yolo_inference.py: load_zones). ZoneType ở src/types/enums.ts là chữ
// thường cho frontend — đừng dùng nhầm giá trị đó khi truy vấn Prisma.
export const MONITORING_ZONE_TYPE = 'MONITORING';

// MONITORING = vùng LÀM VIỆC (chỉ lọc người để xét PPE). Ba loại còn lại là vùng
// NGUY HIỂM: chỉ cần người bước chân vào là engine ghi vi phạm xâm nhập
// (ai-engine/zones.py: intrusions/IntrusionTracker).
export const ZONE_TYPES = ['MONITORING', 'RESTRICTED', 'WARNING', 'SUSPENDED_LOAD'] as const;
export type ZoneKind = (typeof ZONE_TYPES)[number];
export const zoneTypeSchema = z.enum(ZONE_TYPES).default(MONITORING_ZONE_TYPE);

// Toạ độ vùng là TỈ LỆ 0–1 theo khung hình, không phải pixel: đổi độ phân giải
// camera (hoặc kích thước ảnh xem trước) vẫn dùng lại được vùng đã vẽ.
export const zonePointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

// 3 điểm mới thành đa giác; trần 20 điểm để một vùng vẽ tay không phình DB và
// giữ point-in-polygon rẻ khi chạy mỗi khung hình.
export const zonePolygonSchema = z.array(zonePointSchema).min(3).max(20);

export const zonesPayloadSchema = z.object({
  zones: z.array(z.object({
    name: z.string().min(1).max(60).optional(),
    type: zoneTypeSchema,
    points: zonePolygonSchema,
  })).max(10),
});

export type ZonePoint = z.infer<typeof zonePointSchema>;
export type ZonesPayload = z.infer<typeof zonesPayloadSchema>;
export interface ZoneDTO {
  id: string;
  name: string;
  type: ZoneKind;
  points: ZonePoint[];
}

/** Zone.polygonData -> danh sách điểm. null khi JSON hỏng hoặc sai dạng (vùng đó bị bỏ qua). */
export function parseZonePolygon(raw: string): ZonePoint[] | null {
  try {
    const parsed = zonePolygonSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Danh sách điểm -> chuỗi lưu vào Zone.polygonData. Làm tròn 4 chữ số: dưới 1px
 *  ở khung 4K, đủ chính xác mà không lưu cả tá số lẻ của chuột. */
export function serializeZonePolygon(points: ZonePoint[]): string {
  return JSON.stringify(points.map((p) => ({
    x: Number(p.x.toFixed(4)),
    y: Number(p.y.toFixed(4)),
  })));
}

/** Row Zone -> DTO cho web. null khi polygonData hỏng, gọi lọc ra khỏi danh sách.
 *  Zone.type là String tự do trong schema: giá trị lạ (sửa tay trong DB) quy về
 *  MONITORING — vùng lọc người là mặc định an toàn nhất, không tự dựng vùng cấm. */
export function toZoneDTO(row: { id: string; name: string; type: string; polygonData: string }): ZoneDTO | null {
  const points = parseZonePolygon(row.polygonData);
  if (!points) return null;
  const type = (ZONE_TYPES as readonly string[]).includes(row.type)
    ? (row.type as ZoneKind)
    : MONITORING_ZONE_TYPE;
  return { id: row.id, name: row.name, type, points };
}

/** Tên mặc định khi người dùng không đặt tên vùng (thứ tự 0-based). */
export function defaultZoneName(index: number): string {
  return `Vùng ${index + 1}`;
}
