'use client';
// SPDX-License-Identifier: MIT

import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { ViolationType, AlertChannel } from '@/types/enums';
import { chatIdSchema } from '@/lib/validation/alert-rule';
import { useCreateAlertRule, useUpdateAlertRule, type AlertRuleView } from '@/hooks/use-alert-rules';

interface AlertRuleEditDialogProps {
  rule: AlertRuleView | null;
  siteId: string;
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_FORM = {
  name: '',
  violationTypes: [] as string[],
  channels: [] as string[],
  recipients: [] as string[],
  threshold: 1,
  cooldownSec: 180,
  isActive: true,
};

export function AlertRuleEditDialog({ rule, siteId, isOpen, onClose }: AlertRuleEditDialogProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [chatIdInput, setChatIdInput] = useState('');
  const createRule = useCreateAlertRule();
  const updateRule = useUpdateAlertRule();

  useEffect(() => {
    if (isOpen) {
      setForm(
        rule
          ? {
              name: rule.name,
              violationTypes: rule.violationTypes,
              channels: rule.channels,
              recipients: rule.recipients,
              threshold: rule.threshold,
              cooldownSec: rule.cooldownSec,
              isActive: rule.isActive,
            }
          : EMPTY_FORM
      );
      setChatIdInput('');
    }
  }, [isOpen, rule]);

  const toggleInArray = (arr: string[], value: string): string[] =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const addChatId = () => {
    const parsed = chatIdSchema.safeParse(chatIdInput.trim());
    if (!parsed.success) {
      toast(parsed.error.issues[0].message, 'error');
      return;
    }
    if (form.recipients.includes(parsed.data)) return;
    setForm({ ...form, recipients: [...form.recipients, parsed.data] });
    setChatIdInput('');
  };

  const handleSave = async () => {
    if (form.channels.includes(AlertChannel.TELEGRAM) && form.recipients.length === 0) {
      toast('Cần ít nhất 1 người nhận khi bật kênh Telegram', 'error');
      return;
    }
    try {
      if (rule) {
        await updateRule.mutateAsync({ id: rule.id, data: { ...form, siteId } });
      } else {
        await createRule.mutateAsync({ ...form, siteId });
      }
      toast('Đã lưu quy tắc cảnh báo', 'success');
      onClose();
    } catch {
      toast('Lưu quy tắc thất bại', 'error');
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl rounded-xl max-h-[85vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-bold text-[var(--text-primary)]">
            {rule ? 'Sửa quy tắc cảnh báo' : 'Thêm quy tắc cảnh báo'}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-[var(--text-muted)]">
            Chọn loại vi phạm, kênh gửi và người nhận cho công trường này.
          </Dialog.Description>

          <div className="grid gap-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">Tên quy tắc</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="VD: Cảnh báo thiếu mũ bảo hộ"
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Loại vi phạm (bỏ trống = tất cả)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(ViolationType).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm({ ...form, violationTypes: toggleInArray(form.violationTypes, type) })}
                    className={cn(
                      "px-2.5 py-1 rounded-lg border text-[11px] font-medium",
                      form.violationTypes.includes(type)
                        ? "bg-[var(--primary-muted)] border-[var(--primary)] text-[var(--primary-light)]"
                        : "bg-[var(--background)] border-[var(--border)] text-[var(--text-secondary)]"
                    )}
                  >
                    {type.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Kênh gửi</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(AlertChannel).map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => setForm({ ...form, channels: toggleInArray(form.channels, channel) })}
                    className={cn(
                      "px-2.5 py-1 rounded-lg border text-[11px] font-medium",
                      form.channels.includes(channel)
                        ? "bg-[var(--primary-muted)] border-[var(--primary)] text-[var(--primary-light)]"
                        : "bg-[var(--background)] border-[var(--border)] text-[var(--text-secondary)]"
                    )}
                  >
                    {channel}
                  </button>
                ))}
              </div>
            </div>

            {form.channels.includes(AlertChannel.TELEGRAM) && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Chat ID người nhận Telegram
                </label>
                <p className="text-[10px] text-[var(--text-muted)]">
                  Cá nhân: nhắn <code>@userinfobot</code> hoặc <code>/start</code> bot rồi gọi <code>getUpdates</code>.
                  Nhóm: thêm bot vào group trước, <code>getUpdates</code> mới ra id âm (<code>@userinfobot</code> không dùng được cho group).
                </p>
                <div className="flex gap-2">
                  <input
                    value={chatIdInput}
                    onChange={(e) => setChatIdInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChatId(); } }}
                    placeholder="VD: 123456789 hoặc -1001234567890"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={addChatId}
                    className="px-3 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-hover)]"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {form.recipients.map((chatId) => (
                    <div key={chatId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)]">
                      <span className="text-xs font-mono text-[var(--text-primary)]">{chatId}</span>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, recipients: form.recipients.filter((c) => c !== chatId) })}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-[var(--danger)]" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--text-secondary)]">Ngưỡng (số vi phạm)</label>
                <input
                  type="number"
                  min={1}
                  value={form.threshold}
                  onChange={(e) => setForm({ ...form, threshold: Math.max(1, Number(e.target.value)) })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--text-secondary)]">Cooldown (giây)</label>
                <input
                  type="number"
                  min={0}
                  value={form.cooldownSec}
                  onChange={(e) => setForm({ ...form, cooldownSec: Math.max(0, Number(e.target.value)) })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--surface-hover)]">
              Huỷ
            </button>
            <button
              onClick={handleSave}
              disabled={createRule.isPending || updateRule.isPending}
              className="px-6 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-bold hover:bg-[var(--primary-hover)] disabled:opacity-50"
            >
              Lưu
            </button>
          </div>

          <Dialog.Close className="absolute right-4 top-4">
            <X className="h-4 w-4 text-[var(--text-muted)]" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
