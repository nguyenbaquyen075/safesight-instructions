// SPDX-License-Identifier: MIT
import type { CameraAgentView, CameraMemoryNote } from '@/types/agent';

// Bản sao 5 dòng của parseMemory trong agent/lib/camera-agent.ts (nguồn gốc).
// KHÔNG import từ agent/ vào Next: module của worker tự nạp .env và có Prisma
// client riêng, kéo vào bundle web sẽ nạp cả worker. JSON hỏng (sửa tay, ghi dở)
// không được làm chết cả danh sách: coi như camera chưa có trí nhớ.
export function parseMemory(raw: string): CameraMemoryNote[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CameraMemoryNote[]) : [];
  } catch {
    return [];
  }
}

// Mặc định khớp @default trong model CameraAgent (prisma/schema.prisma).
// GET không upsert: camera chưa từng chạy phiên nào vẫn hiện đúng như lúc sẽ được tạo.
export const CAMERA_AGENT_DEFAULTS = { isEnabled: true, digestEveryMin: 30, dailyTokenCap: 300_000, tokensUsedToday: 0 } as const;

// Chỉ nhận đúng các cột cần dùng: hàm thuần, test dựng object thường được.
export interface CameraAgentRow {
  isEnabled: boolean;
  memory: string;
  digestEveryMin: number;
  dailyTokenCap: number;
  tokensUsedToday: number;
  lastDigestAt: Date | null;
}

export interface CameraAgentStats {
  openViolations: number;
  reviewed24h: number;
  falsePositiveRate24h: number;
}

export function toCameraAgentView(
  camera: { id: string; name: string; siteId: string; status: string; site: { name: string } },
  row: CameraAgentRow | null,
  stats: CameraAgentStats,
): CameraAgentView {
  return {
    cameraId: camera.id,
    name: camera.name,
    siteId: camera.siteId,
    siteName: camera.site.name,
    // DB lưu "ONLINE"/"OFFLINE", enum CameraStatus ở frontend là chữ thường (xem camera-shape.ts).
    cameraStatus: camera.status.toLowerCase(),
    exists: row !== null,
    isEnabled: row?.isEnabled ?? CAMERA_AGENT_DEFAULTS.isEnabled,
    digestEveryMin: row?.digestEveryMin ?? CAMERA_AGENT_DEFAULTS.digestEveryMin,
    dailyTokenCap: row?.dailyTokenCap ?? CAMERA_AGENT_DEFAULTS.dailyTokenCap,
    tokensUsedToday: row?.tokensUsedToday ?? CAMERA_AGENT_DEFAULTS.tokensUsedToday,
    lastDigestAt: row?.lastDigestAt?.toISOString() ?? null,
    memory: row ? parseMemory(row.memory) : [],
    ...stats,
  };
}
