// SPDX-License-Identifier: MIT

import { useQuery } from '@tanstack/react-query';
import type { Violation } from '@/types/models';

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
