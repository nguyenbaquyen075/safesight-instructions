// SPDX-License-Identifier: MIT
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AgentEventView, AgentSettingsView, AgentTaskView, CameraAgentUpdate, CameraAgentView } from '@/types/agent';

const qs = (o: Record<string, string | number | undefined>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString();

export function useAgentTasks(filter: { status?: 'open' | 'done'; subjectType?: string; subjectId?: string; limit?: number } = {}) {
  return useQuery<AgentTaskView[]>({
    queryKey: ['agent-tasks', filter],
    queryFn: async () => { const r = await fetch(`/api/agent/tasks?${qs(filter)}`); if (!r.ok) throw new Error('Không tải được task agent'); return r.json(); },
    refetchInterval: 10_000,
  });
}

export function useAgentEvents(filter: { sessionId?: string; subjectType?: string; subjectId?: string; type?: string; limit?: number }, opts: { live?: boolean; enabled?: boolean } = {}) {
  return useQuery<AgentEventView[]>({
    queryKey: ['agent-events', filter],
    queryFn: async () => { const r = await fetch(`/api/agent/events?${qs(filter)}`); if (!r.ok) throw new Error('Không tải được nhật ký agent'); return r.json(); },
    refetchInterval: opts.live ? 2_000 : 15_000,
    enabled: opts.enabled ?? true,
  });
}

export function useAgentSettings() {
  return useQuery<AgentSettingsView>({ queryKey: ['agent-settings'], queryFn: async () => { const r = await fetch('/api/agent/settings'); if (!r.ok) throw new Error('Không tải được cài đặt agent'); return r.json(); } });
}

export function useSaveAgentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<AgentSettingsView>) => { const r = await fetch('/api/agent/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (!r.ok) throw new Error('Lưu cài đặt thất bại'); return r.json() as Promise<AgentSettingsView>; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-settings'] }),
  });
}

export function useAskAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { message: string; subjectType?: string; subjectId?: string; sessionId?: string }) => { const r = await fetch('/api/agent/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (!r.ok) throw new Error('Gửi câu hỏi thất bại'); return r.json() as Promise<{ sessionId: string; taskId: string }>; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agent-events'] }); qc.invalidateQueries({ queryKey: ['agent-tasks'] }); },
  });
}

// Subagent theo camera: danh sách đủ cho cả lưới thẻ ở /agent và panel trong modal camera
// (lọc theo cameraId ở phía component thay vì thêm một route chi tiết).
export function useCameraAgents() {
  return useQuery<CameraAgentView[]>({
    queryKey: ['camera-agents'],
    queryFn: async () => { const r = await fetch('/api/agent/cameras'); if (!r.ok) throw new Error('Không tải được subagent camera'); return r.json(); },
    refetchInterval: 15_000,
  });
}

export function useSaveCameraAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cameraId, ...data }: CameraAgentUpdate & { cameraId: string }) => {
      const r = await fetch(`/api/agent/cameras/${cameraId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error('Lưu subagent camera thất bại');
      return r.json() as Promise<Pick<CameraAgentView, 'isEnabled' | 'digestEveryMin' | 'dailyTokenCap' | 'memory'>>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['camera-agents'] }),
  });
}

export function useDigestCamera() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cameraId: string) => {
      const r = await fetch(`/api/agent/cameras/${cameraId}/digest`, { method: 'POST' });
      if (!r.ok) throw new Error('Không xếp được lượt tổng hợp');
      return r.json() as Promise<{ taskId: string }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-tasks'] }),
  });
}
