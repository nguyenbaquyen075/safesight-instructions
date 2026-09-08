'use client';
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { Eye, EyeOff, MessageCircle, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { SectionHeader, SettingCard, InputGroup, Switch } from './ui';
import {
  useZaloSettings,
  useSaveZaloSettings,
  useTestZaloConnection,
} from '@/hooks/use-zalo-settings';

export function ZaloOaCard() {
  const { data: settings } = useZaloSettings();
  const saveSettings = useSaveZaloSettings();
  const testConnection = useTestZaloConnection();
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);

  const handleTest = async () => {
    try {
      await testConnection.mutateAsync(tokenInput || undefined);
      toast('Kết nối Zalo OA thành công', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kiểm tra kết nối thất bại', 'error');
    }
  };

  const handleSave = async () => {
    try {
      await saveSettings.mutateAsync({ accessToken: tokenInput || undefined });
      setTokenInput('');
      toast('Đã lưu cấu hình Zalo OA', 'success');
    } catch {
      toast('Lưu cấu hình thất bại', 'error');
    }
  };

  const handleToggle = async (enabled: boolean) => {
    try {
      await saveSettings.mutateAsync({ isEnabled: enabled });
    } catch {
      toast('Cập nhật trạng thái thất bại', 'error');
    }
  };

  return (
    <SettingCard>
      <SectionHeader title="Zalo OA" description="Gửi cảnh báo vi phạm qua Official Account của Zalo." />
      <div className="space-y-4">
        <Switch
          enabled={!!settings?.isEnabled}
          onChange={handleToggle}
          label="Bật cảnh báo Zalo"
          description="Tắt sẽ dừng gửi ở mọi quy tắc cảnh báo"
        />
        <InputGroup
          label="Access Token"
          description="Lấy từ Zalo OA Open Platform (token hết hạn sau 25 giờ, cần cập nhật lại). Để trống nếu không muốn đổi token đã lưu."
        >
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder={settings?.hasToken ? 'Đã cấu hình' : 'Dán access token vào đây'}
              className="w-full px-4 py-2.5 pr-10 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] focus:border-[var(--primary)] text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </InputGroup>
        <div className="flex gap-2">
          <button
            onClick={handleTest}
            disabled={testConnection.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            {testConnection.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            <MessageCircle className="w-4 h-4" />
            Kiểm tra kết nối
          </button>
          <button
            onClick={handleSave}
            disabled={saveSettings.isPending}
            className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-bold hover:bg-[var(--primary-hover)] disabled:opacity-50"
          >
            Lưu
          </button>
        </div>
      </div>
    </SettingCard>
  );
}
