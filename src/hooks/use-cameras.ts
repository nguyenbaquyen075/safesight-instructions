// SPDX-License-Identifier: MIT

import { useQuery } from '@tanstack/react-query';
import type { Camera } from '@/types/models';

export function useCameras(filters?: { siteId?: string; status?: string }) {
  return useQuery<Camera[]>({
    queryKey: ['cameras', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.siteId) params.append('siteId', filters.siteId);
      if (filters?.status) params.append('status', filters.status);
      
      const res = await fetch(`/api/cameras?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch cameras');
      return res.json();
    },
  });
}

export function useCamera(id: string) {
  return useQuery<Camera>({
    queryKey: ['cameras', id],
    queryFn: async () => {
      const res = await fetch(`/api/cameras/${id}`);
      if (!res.ok) throw new Error('Failed to fetch camera');
      return res.json();
    },
    enabled: !!id,
  });
}
