// SPDX-License-Identifier: MIT

export interface AgentTaskView {
  id: string; kind: string; subjectType: string | null; subjectId: string | null; reason: string;
  priority: number; attempts: number; dueAt: string; startedAt: string | null; finishedAt: string | null; outcome: string | null; sessionId: string | null;
}

export interface AgentEventView {
  id: string; sessionId: string; taskId: string | null; subjectType: string | null; subjectId: string | null;
  type: string; data: Record<string, unknown>; emittedAt: string;
}

export interface AgentSettingsView {
  isEnabled: boolean; model: string; reviewEffort: string; dailyTokenCap: number; shiftReportAt: string;
}

export interface AgentReview {
  verdict: 'false_positive' | 'violation' | 'undecided'; band: 'VERIFIED' | 'PROBABLE' | 'POSSIBLE' | null;
  score: number; observations: string[]; note: string; rationale: string; sessionId: string; reviewedAt: string;
}

export const OBSERVATION_LABELS: Record<string, string> = {
  'snapshot.no-person': 'khung đỏ không có người',
  'snapshot.ppe-visible': 'món bị báo thiếu nhìn thấy rõ',
  'snapshot.ppe-clearly-missing': 'thấy rõ thiếu đồ bảo hộ',
  'track.confirmed-repeat': 'cùng người tái phạm',
  'history.camera-false-positive-prone': 'camera hay báo oan',
  'snapshot.occluded-or-backlit': 'che khuất / ngược sáng',
  'snapshot.person-outside-work-zone': 'người ngoài khu làm việc',
  'contradiction': 'bằng chứng mâu thuẫn',
};

// Một ghi chú trí nhớ camera (khớp CameraMemoryNote trong agent/lib/camera-agent.ts).
export interface CameraMemoryNote { at: string; text: string; sessionId: string }

// Một subagent camera cho UI: cài đặt + mức dùng + vài số liệu 24h của camera đó.
export interface CameraAgentView {
  cameraId: string; name: string; siteId: string; siteName: string; cameraStatus: string;
  exists: boolean; // false = chưa có dòng CameraAgent, đang hiển thị giá trị mặc định
  isEnabled: boolean; digestEveryMin: number; dailyTokenCap: number; tokensUsedToday: number;
  lastDigestAt: string | null; memory: CameraMemoryNote[];
  openViolations: number; reviewed24h: number; falsePositiveRate24h: number;
}

export interface CameraAgentUpdate {
  isEnabled?: boolean; digestEveryMin?: number; dailyTokenCap?: number; clearMemory?: true;
}
