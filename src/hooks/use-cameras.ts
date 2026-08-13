// SPDX-License-Identifier: MIT

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Camera } from '@/types/models';

export interface CameraInput {
  name: string;
  siteId: string;
  location: string;
  type?: Camera['type'];
  source: string; // "webcam:<số>" hoặc "rtsp://..."
}

export function useCameras(filters?: { siteId?: string; status?: string; includeDemo?: boolean }) {
  return useQuery<Camera[]>({
    queryKey: ['cameras', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.siteId) params.append('siteId', filters.siteId);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.includeDemo) params.append('includeDemo', 'true');

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

export function useCreateCamera() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CameraInput) => {
      const res = await fetch('/api/cameras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to create camera');
      return res.json() as Promise<Camera>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cameras'] }),
  });
}

export function useUpdateCamera() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CameraInput> & { status?: string } }) => {
      const res = await fetch(`/api/cameras/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update camera');
      return res.json() as Promise<Camera>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cameras'] }),
  });
}

export function useDeleteCamera() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/cameras/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete camera');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cameras'] }),
  });
}
