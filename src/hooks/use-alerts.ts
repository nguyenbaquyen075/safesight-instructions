// SPDX-License-Identifier: MIT

import { useQuery } from '@tanstack/react-query';
import type { Alert } from '@/types/models';

export function useAlerts(filters?: { status?: string; channel?: string }) {
  return useQuery<Alert[]>({
    queryKey: ['alerts', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.channel) params.append('channel', filters.channel);
      
      const res = await fetch(`/api/alerts?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch alerts');
      return res.json();
    },
  });
}
