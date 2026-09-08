// SPDX-License-Identifier: MIT
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../lib/env';
import { prisma } from '../lib/db';
import { readHeartbeat } from '../lib/capabilities';

export const THRESHOLDS = { cameraStalledMs: 90_000, cameraOfflineMs: 600_000, heartbeatStaleMs: 30_000, bridgeFailStreak: 3 } as const;

export const MODEL_FILES = [
  { file: 'ppe_multiclass.pt', required: true },
  { file: 'ppe_boots.pt', required: false },
  { file: 'ppe_gang.pt', required: false },
  { file: 'yolov8n-pose.pt', required: false },
] as const;

export interface HealthSignals {
  now: number;
  bridge: { ok: boolean; lastDetectionAt: Record<string, string> } | null;
  heartbeat: { pid: number; at: string; streams: number; fps: number } | null;
  pidAlive: boolean;
  snapshotBytes: number;
  modelFiles: { required: boolean; present: boolean; file?: string }[];
  cameras: { id: string; status: string; rtspUrl: string }[];
  /** Id các việc khắc phục quá hạn chưa từng leo thang; tên người lấy sau, lúc dựng lý do. */
  overdueActionIds: string[];
}

export type FindingCode = 'camera.stalled' | 'camera.recovered' | 'engine.stalled' | 'bridge.down' | 'disk.pressure' | 'model.missing' | 'capa.overdue';
export interface Finding { code: FindingCode; subjectType: 'camera' | 'system'; subjectId: string | null; detail: Record<string, unknown> }

function processAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM'; } // có tiến trình nhưng không đủ quyền gửi tín hiệu = vẫn sống
}

// "Còn sống" không đủ: pid có thể đã bị hệ điều hành tái sử dụng cho tiến trình khác sau khi
// engine đã tắt. Trên Linux đọc /proc/<pid>/cmdline để chắc pid đó thật sự là yolo_inference.py.
// Ngoài Linux không có /proc: chỉ kiểm còn sống — coi engine khoẻ là "đã mất" thì mỗi vòng quét
// lại sinh engine.stalled giả và leo thang cho trực vận hành.
async function isEngineProcess(pid: number): Promise<boolean> {
  if (!processAlive(pid)) return false;
  if (process.platform !== 'linux') return true;
  try {
    const cmdline = await readFile(`/proc/${pid}/cmdline`, 'utf8');
    return cmdline.includes('yolo_inference.py');
  } catch { return false; }
}

async function dirBytes(dir: string): Promise<number> {
  try {
    let total = 0;
    for (const name of await readdir(dir)) {
      if (!name.endsWith('.jpg')) continue;
      total += (await stat(path.join(dir, name))).size;
    }
    return total;
  } catch { return 0; }
}

async function exists(file: string): Promise<boolean> {
  try { await stat(path.resolve(process.cwd(), file)); return true; } catch { return false; }
}

// Chỉ lấy việc CHƯA từng leo thang: escalatedAt là dấu "đã báo người rồi", nếu không mỗi
// vòng quét 60s lại báo lại đúng những việc đó. Trần 50 việc để một tồn đọng lớn không
// kéo cả lượt quét. Chỉ trả id: detail của finding đi thẳng vào AgentEvent nên phải gọn,
// tên người xử lý được đọc lại lúc dựng lý do leo thang (agent/direct/actions.ts).
export async function findOverdueActionIds(now = new Date()): Promise<string[]> {
  try {
    const rows = await prisma.correctiveAction.findMany({
      where: { status: 'OPEN', escalatedAt: null, dueAt: { lt: now } },
      orderBy: { dueAt: 'asc' },
      take: 50,
      select: { id: true },
    });
    return rows.map(r => r.id);
  } catch (error) {
    console.warn('[health] không đọc được bảng CorrectiveAction', error instanceof Error ? error.message : String(error));
    return [];
  }
}

export async function collectSignals(): Promise<HealthSignals> {
  let bridge: HealthSignals['bridge'] = null;
  try {
    const res = await fetch(`${env.bridgeUrl}/health`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) { const j = await res.json(); bridge = { ok: true, lastDetectionAt: j.lastDetectionAt ?? {} }; }
  } catch { bridge = null; }
  const heartbeat = await readHeartbeat();
  let cameras: HealthSignals['cameras'] = [];
  try {
    cameras = await prisma.camera.findMany({ select: { id: true, status: true, rtspUrl: true } });
  } catch (error) {
    console.warn('[health] không đọc được bảng Camera', error instanceof Error ? error.message : String(error));
  }
  return {
    now: Date.now(),
    bridge,
    heartbeat,
    pidAlive: heartbeat ? await isEngineProcess(heartbeat.pid) : false,
    snapshotBytes: await dirBytes(env.snapshotDir),
    modelFiles: await Promise.all(MODEL_FILES.map(async m => ({ file: m.file, required: m.required, present: await exists(m.file) }))),
    cameras,
    overdueActionIds: await findOverdueActionIds(),
  };
}

export function decide(s: HealthSignals, opts: { snapshotMaxMb: number; bridgeFailStreak: number }): Finding[] {
  const out: Finding[] = [];

  if (s.bridge === null) {
    if (opts.bridgeFailStreak >= THRESHOLDS.bridgeFailStreak) out.push({ code: 'bridge.down', subjectType: 'system', subjectId: null, detail: { streak: opts.bridgeFailStreak } });
  } else {
    for (const cam of s.cameras) {
      const last = s.bridge.lastDetectionAt[cam.id];
      const parsed = last ? Date.parse(last) : Number.NaN;
      // Chưa từng thấy hoặc timestamp hỏng -> coi như đã rất lâu (an toàn về phía cảnh báo)
      const ageMs = Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : s.now - parsed;
      const stalled = ageMs > THRESHOLDS.cameraStalledMs;
      if (cam.status === 'ONLINE' && stalled) {
        out.push({ code: 'camera.stalled', subjectType: 'camera', subjectId: cam.id, detail: { ageMs, offline: ageMs > THRESHOLDS.cameraOfflineMs, rtspUrl: cam.rtspUrl } });
      } else if ((cam.status === 'DEGRADED' || cam.status === 'OFFLINE') && !stalled) {
        out.push({ code: 'camera.recovered', subjectType: 'camera', subjectId: cam.id, detail: { ageMs } });
      }
    }
  }

  if (s.heartbeat) {
    const parsedAt = Date.parse(s.heartbeat.at);
    const age = Number.isNaN(parsedAt) ? Number.POSITIVE_INFINITY : s.now - parsedAt;
    // Không hạ pidAlive theo tuổi heartbeat nữa: bước kiểm danh tính (cmdline) đã loại pid bị tái
    // sử dụng, còn engine treo thật (pid sống, kẹt trong cv2/torch) phải giữ pidAlive=true thì
    // actions.ts mới SIGTERM được — hạ về false sau 5 phút làm nó không bao giờ được khởi động lại.
    if (age > THRESHOLDS.heartbeatStaleMs || !s.pidAlive) {
      out.push({ code: 'engine.stalled', subjectType: 'system', subjectId: null, detail: { pid: s.heartbeat.pid, heartbeatAgeMs: age, pidAlive: s.pidAlive } });
    }
  }

  if (s.snapshotBytes > opts.snapshotMaxMb * 1024 * 1024) {
    out.push({ code: 'disk.pressure', subjectType: 'system', subjectId: null, detail: { bytes: s.snapshotBytes, maxMb: opts.snapshotMaxMb } });
  }
  for (const m of s.modelFiles) {
    if (m.required && !m.present) out.push({ code: 'model.missing', subjectType: 'system', subjectId: null, detail: { file: m.file ?? 'ppe_multiclass.pt' } });
  }
  // Việc khắc phục quá hạn là chuyện của NGƯỜI, agent không tự làm được -> gộp thành một
  // phát hiện toàn hệ thống rồi leo thang một lần, thay vì mỗi việc một finding.
  if (s.overdueActionIds.length > 0) {
    out.push({ code: 'capa.overdue', subjectType: 'system', subjectId: null, detail: { count: s.overdueActionIds.length, ids: s.overdueActionIds } });
  }
  return out;
}
