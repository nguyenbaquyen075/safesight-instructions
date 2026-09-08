// SPDX-License-Identifier: MIT
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { askProgress, toChatItems } from '@/lib/chat-shape';
import type { AgentEventView, AgentSettingsView, AgentTaskView, CameraAgentUpdate, CameraAgentView } from '@/types/agent';
import type { AgentAccuracy } from '@/lib/agent-accuracy-shape';

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

export type AskSubjectType = 'violation' | 'camera' | 'site' | 'system';

// Một cuộc hỏi đáp với agent (dùng chung cho widget nổi, trang /agent và tab Agent trong modal):
// gửi qua /api/agent/ask, poll event theo sessionId khi đang chờ, im lặng 90s hoặc session.ended là xong.
export function useAskSession({ subjectType = 'system', subjectId }: { subjectType?: AskSubjectType; subjectId?: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sentAt, setSentAt] = useState<number | null>(null);
  const ask = useAskAgent();
  const { data: events = [] } = useAgentEvents({ sessionId: sessionId ?? undefined, limit: 200 }, { live: sentAt !== null, enabled: !!sessionId });

  // Tick 5s để hết hạn 90s (askProgress) cũng tự tắt poll.
  const [tick, setTick] = useState(0);
  useEffect(() => { if (sentAt === null) return; const t = setInterval(() => setTick(n => n + 1), 5_000); return () => clearInterval(t); }, [sentAt]);
  void tick;
  // eslint-disable-next-line react-hooks/purity -- Date.now() chỉ dùng để tính "còn đang chờ" cho hiển thị; đồng hồ tick 5s đã ép re-render, không phải nguồn state
  const { working } = askProgress({ sentAt, events, now: Date.now() });

  useEffect(() => {
    if (sentAt !== null && !working) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- tắt poll khi phiên đã xong
      setSentAt(null);
    }
  }, [working, sentAt]);

  const submit = async () => {
    const message = text.trim(); if (!message || ask.isPending) return;
    const r = await ask.mutateAsync({ message, subjectType, subjectId, sessionId: sessionId ?? undefined });
    setSessionId(r.sessionId); setSentAt(Date.now()); setText('');
  };

  const items = useMemo(() => toChatItems(events), [events]);
  return { text, setText, submit, items, working, isPending: ask.isPending, isError: ask.isError };
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

// Độ chính xác của agent trong N ngày gần nhất (thẻ ở /agent). Chỉ gửi `from`: route tự
// lấy đến hết hôm nay.
export function useAgentAccuracy(days: number) {
  return useQuery<AgentAccuracy>({
    queryKey: ['agent-accuracy', days],
    queryFn: async () => {
      const from = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
      const r = await fetch(`/api/stats/agent-accuracy?${qs({ from })}`);
      if (!r.ok) throw new Error('Không tải được độ chính xác của agent');
      return r.json();
    },
  });
}
