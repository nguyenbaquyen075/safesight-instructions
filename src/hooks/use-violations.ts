// SPDX-License-Identifier: MIT

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Violation } from '@/types/models';
import type { ViolationStatus } from '@/types/enums';
import type { ActionStatus, CorrectiveActionDTO } from '@/lib/corrective-action-shape';

// Không có kênh đẩy realtime cho ghi DB (AI engine là process riêng, ghi qua POST
// /api/violations) -> polling định kỳ. React Query gộp chung 1 poll cho mọi trang
// cùng gọi useViolations() với cùng filters, thay vì mỗi trang tự poll riêng.
const POLL_MS = 15000;

export function useViolations(filters?: { siteId?: string; status?: string; type?: string; severity?: string }) {
  return useQuery<Violation[]>({
    queryKey: ['violations', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.siteId) params.append('siteId', filters.siteId);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.type) params.append('type', filters.type);
      if (filters?.severity) params.append('severity', filters.severity);

      const res = await fetch(`/api/violations?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch violations');
      return res.json();
    },
    refetchInterval: POLL_MS,
  });
}

// Sidebar chỉ cần số vi phạm đang mở -> gọi endpoint COUNT thay vì tải cả danh sách.
// Key nằm dưới tiền tố ['violations'] nên các invalidateQueries sẵn có cũng làm mới nó.
export function useOpenViolationCount() {
  return useQuery<{ open: number; openIds: string[] }>({
    queryKey: ['violations', 'open-count'],
    queryFn: async () => {
      const res = await fetch('/api/violations/count');
      if (!res.ok) throw new Error('Failed to fetch open violation count');
      return res.json();
    },
    refetchInterval: POLL_MS,
  });
}

export function useViolation(id: string) {
  return useQuery<Violation>({
    queryKey: ['violations', id],
    queryFn: async () => {
      const res = await fetch(`/api/violations/${id}`);
      if (!res.ok) throw new Error('Failed to fetch violation');
      return res.json();
    },
    enabled: !!id,
  });
}

export function useDeleteViolation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/violations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete violation');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['violations'] }),
  });
}

export function useUpdateViolationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ViolationStatus }) => {
      const res = await fetch(`/api/violations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update violation status');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['violations'] }),
  });
}

// --- Việc khắc phục (CAPA) ---------------------------------------------------
// Cùng file với vi phạm vì mọi việc khắc phục đều treo dưới một vi phạm; key nằm dưới
// tiền tố ['actions'] để mutation làm mới cả modal lẫn mục "Việc khắc phục" ở /reports.

export function useViolationActions(violationId: string) {
  return useQuery<CorrectiveActionDTO[]>({
    queryKey: ['actions', 'violation', violationId],
    queryFn: async () => {
      const res = await fetch(`/api/violations/${violationId}/actions`);
      if (!res.ok) throw new Error('Không tải được danh sách việc khắc phục');
      return (await res.json()).actions;
    },
    enabled: !!violationId,
  });
}

export function useOpenCorrectiveActions(filters?: { siteId?: string; status?: 'open' | 'overdue'; limit?: number }) {
  return useQuery<CorrectiveActionDTO[]>({
    queryKey: ['actions', 'list', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.siteId) params.append('siteId', filters.siteId);
      if (filters?.status) params.append('status', filters.status);
      // Không truyền limit thì route trả mặc định 100 việc — trang báo cáo cần trần rõ ràng.
      if (filters?.limit) params.append('limit', String(filters.limit));
      const res = await fetch(`/api/actions?${params.toString()}`);
      if (!res.ok) throw new Error('Không tải được việc khắc phục');
      return (await res.json()).actions;
    },
  });
}

export function useCreateCorrectiveAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ violationId, ...body }: { violationId: string; assigneeId?: string; assigneeName: string; description: string; dueAt?: string }) => {
      const res = await fetch(`/api/violations/${violationId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Không giao được việc khắc phục');
      return res.json() as Promise<CorrectiveActionDTO>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions'] });
      queryClient.invalidateQueries({ queryKey: ['violations'] });
    },
  });
}

export function useUpdateCorrectiveAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; status: ActionStatus; evidenceNote?: string }) => {
      const res = await fetch(`/api/actions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Không cập nhật được việc khắc phục');
      return res.json() as Promise<CorrectiveActionDTO>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions'] });
      queryClient.invalidateQueries({ queryKey: ['violations'] });
    },
  });
}

// Người chấm phán quyết của agent đúng/sai (G3). Làm mới ['violations'] để danh sách và
// modal cùng thấy phản hồi mới, và ['agent-accuracy'] để thẻ độ chính xác ở /agent cập nhật.
export function useSubmitReviewFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; correct: boolean; note?: string }) => {
      const res = await fetch(`/api/violations/${id}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Không gửi được đánh giá phán quyết');
      return res.json() as Promise<Violation>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['violations'] });
      queryClient.invalidateQueries({ queryKey: ['agent-accuracy'] });
    },
  });
}
