// SPDX-License-Identifier: MIT

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface AlertRuleView {
  id: string;
  siteId: string;
  name: string;
  violationTypes: string[];
  channels: string[];
  recipients: string[];
  threshold: number;
  cooldownSec: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AlertRuleInput = Omit<AlertRuleView, 'id' | 'createdAt' | 'updatedAt'>;

export function useAlertRules(siteId?: string) {
  return useQuery<AlertRuleView[]>({
    queryKey: ['alert-rules', siteId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (siteId) params.append('siteId', siteId);
      const res = await fetch(`/api/alert-rules?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch alert rules');
      return res.json();
    },
    enabled: !!siteId,
  });
}

export function useCreateAlertRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: AlertRuleInput) => {
      const res = await fetch('/api/alert-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create alert rule');
      return res.json() as Promise<AlertRuleView>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-rules'] }),
  });
}

export function useUpdateAlertRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AlertRuleInput> }) => {
      const res = await fetch(`/api/alert-rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update alert rule');
      return res.json() as Promise<AlertRuleView>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-rules'] }),
  });
}

export function useDeleteAlertRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/alert-rules/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete alert rule');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-rules'] }),
  });
}
