// SPDX-License-Identifier: MIT
import type { CameraAgent } from '@prisma/client';
import { prisma } from './db';

// Một ghi chú trí nhớ của camera: giờ ghi, nội dung, phiên đã ghi.
export interface CameraMemoryNote { at: string; text: string; sessionId: string }

export const MEMORY_MAX = 20;
export const NOTE_MAX = 300;

// Trần token tính theo NGÀY ĐỊA PHƯƠNG (giống msUntilMidnight ở session.ts), không phải UTC.
export function localDay(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Task nào thuộc camera nào: camera → chính nó, violation → camera của vi phạm, còn lại là phiên toàn hệ thống.
export async function cameraIdOf(task: { subjectType: string | null; subjectId: string | null }): Promise<string | null> {
  if (!task.subjectId) return null;
  if (task.subjectType === 'camera') return task.subjectId;
  if (task.subjectType === 'violation') {
    const v = await prisma.violation.findUnique({ where: { id: task.subjectId }, select: { cameraId: true } });
    return v?.cameraId ?? null;
  }
  return null;
}

// Tạo lười dòng subagent; sang ngày mới thì reset mức token đã dùng.
export async function getCameraAgent(cameraId: string, now = new Date()): Promise<CameraAgent> {
  const day = localDay(now);
  const row = await prisma.cameraAgent.upsert({ where: { id: cameraId }, update: {}, create: { id: cameraId, usageDay: day } });
  if (row.usageDay === day) return row;
  return prisma.cameraAgent.update({ where: { id: cameraId }, data: { tokensUsedToday: 0, usageDay: day } });
}

// JSON hỏng (sửa tay, ghi dở) không được làm chết phiên: coi như chưa có trí nhớ.
export function parseMemory(raw: string): CameraMemoryNote[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CameraMemoryNote[]) : [];
  } catch {
    return [];
  }
}

// Hàm thuần: cắt nội dung về NOTE_MAX, sửa tại chỗ khi có replaceIndex, giữ tối đa MEMORY_MAX ghi chú mới nhất.
export function pushMemory(notes: CameraMemoryNote[], note: CameraMemoryNote, replaceIndex?: number): CameraMemoryNote[] {
  const trimmed: CameraMemoryNote = { ...note, text: note.text.slice(0, NOTE_MAX) };
  if (replaceIndex !== undefined && replaceIndex >= 0 && replaceIndex < notes.length) {
    const next = [...notes];
    next[replaceIndex] = trimmed;
    return next;
  }
  return [...notes, trimmed].slice(-MEMORY_MAX);
}

/** Ghi trí nhớ là "đọc JSON -> thêm ghi chú -> ghi lại cả chuỗi". Chạy nhiều worker
 * (mỗi worker một tiến trình `agent/main.ts`) thì hai phiên của cùng một camera có thể
 * đọc cùng một bản `memory` rồi ghi đè nhau -> mất ghi chú, không báo lỗi.
 *
 * Cách sửa: cập nhật có điều kiện (optimistic) — `updateMany` chỉ ghi khi `memory` trong
 * DB vẫn đúng bản vừa đọc; `count === 0` nghĩa là worker khác chen vào, đọc lại rồi thử
 * lần hai trên bản mới nên ghi chú của cả hai đều còn.
 *
 * Cố ý so theo `memory` chứ không theo `updatedAt`: `updatedAt` của SQLite chỉ tới
 * mili-giây (hai lượt ghi trong cùng 1ms sẽ không phát hiện được xung đột) và bị
 * `addCameraTokens` đụng vào liên tục (báo xung đột giả). So thẳng giá trị đang sửa là
 * đúng nghĩa compare-and-swap.
 *
 * ponytail: thử lại 1 lần là đủ cho nhịp thực tế (≤ 3 lần ghi/phiên, phiên thưa); nếu về
 * sau có nhiều worker ghi dày hơn thì đổi thành vòng lặp có backoff. */
export async function rememberCamera(cameraId: string, text: string, sessionId: string, replaceIndex?: number): Promise<CameraMemoryNote[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const agent = await getCameraAgent(cameraId);
    const notes = pushMemory(parseMemory(agent.memory), { at: new Date().toISOString(), text, sessionId }, replaceIndex);
    const { count } = await prisma.cameraAgent.updateMany({
      where: { id: cameraId, memory: agent.memory },
      data: { memory: JSON.stringify(notes) },
    });
    if (count > 0) return notes;
  }
  throw new Error(`rememberCamera: xung đột ghi trí nhớ camera ${cameraId} sau 2 lần thử`);
}

export async function addCameraTokens(cameraId: string, tokens: number, now = new Date()): Promise<void> {
  await getCameraAgent(cameraId, now); // đảm bảo dòng tồn tại và đã reset nếu sang ngày mới
  await prisma.cameraAgent.update({ where: { id: cameraId }, data: { tokensUsedToday: { increment: tokens } } });
}

// Digest chỉ đáng mở phiên khi có gì mới: vi phạm mới hoặc event health của chính camera này.
export async function hasActivitySince(cameraId: string, since: Date | null): Promise<boolean> {
  if (since === null) return true;
  const violations = await prisma.violation.count({ where: { cameraId, detectedAt: { gt: since } } });
  if (violations > 0) return true;
  const events = await prisma.agentEvent.count({ where: { subjectType: 'camera', subjectId: cameraId, type: 'health', emittedAt: { gt: since } } });
  return events > 0;
}
