// SPDX-License-Identifier: MIT

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface ZaloSettingsView {
  isEnabled: boolean;
  hasToken: boolean;
}

export function useZaloSettings() {
  return useQuery<ZaloSettingsView>({
    queryKey: ['zalo-settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings/zalo');
      if (!res.ok) throw new Error('Failed to fetch Zalo settings');
      return res.json();
    },
  });
}

export function useSaveZaloSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { accessToken?: string; isEnabled?: boolean }) => {
      const res = await fetch('/api/settings/zalo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save Zalo settings');
      return res.json() as Promise<ZaloSettingsView>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zalo-settings'] }),
  });
}

export function useTestZaloConnection() {
  return useMutation({
    mutationFn: async (accessToken?: string) => {
      const res = await fetch('/api/settings/zalo/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Kiểm tra kết nối thất bại');
      return data as { success: true; oaInfo: unknown };
    },
  });
}
