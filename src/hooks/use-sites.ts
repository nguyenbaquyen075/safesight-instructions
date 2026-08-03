// SPDX-License-Identifier: MIT

import { useQuery } from '@tanstack/react-query';
import type { Site } from '@/types/models';

export function useSites(filters?: { status?: string }) {
  return useQuery<Site[]>({
    queryKey: ['sites', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      
      const res = await fetch(`/api/sites?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch sites');
      return res.json();
    },
  });
}

export function useSite(id: string) {
  return useQuery<Site>({
    queryKey: ['sites', id],
    queryFn: async () => {
      const res = await fetch(`/api/sites/${id}`);
      if (!res.ok) throw new Error('Failed to fetch site');
      return res.json();
    },
    enabled: !!id,
  });
}
