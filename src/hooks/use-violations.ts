// SPDX-License-Identifier: MIT

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Violation } from '@/types/models';
import type { ViolationStatus } from '@/types/enums';

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
  return useQuery<{ open: number }>({
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
