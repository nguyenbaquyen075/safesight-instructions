// SPDX-License-Identifier: MIT

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface TelegramSettingsView {
  isEnabled: boolean;
  hasToken: boolean;
}

export function useTelegramSettings() {
  return useQuery<TelegramSettingsView>({
    queryKey: ['telegram-settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings/telegram');
      if (!res.ok) throw new Error('Failed to fetch Telegram settings');
      return res.json();
    },
  });
}

export function useSaveTelegramSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { botToken?: string; isEnabled?: boolean }) => {
      const res = await fetch('/api/settings/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save Telegram settings');
      return res.json() as Promise<TelegramSettingsView>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['telegram-settings'] }),
  });
}

export function useTestTelegramConnection() {
  return useMutation({
    mutationFn: async (botToken?: string) => {
      const res = await fetch('/api/settings/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Kiểm tra kết nối thất bại');
      return data as { success: true; botInfo: unknown };
    },
  });
}
