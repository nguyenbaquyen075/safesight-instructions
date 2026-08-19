'use client';
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { Plus, Pencil, Trash2, Send } from 'lucide-react';
import { toast } from '@/lib/toast';
import { SectionHeader, SettingCard } from './ui';
import { useSites } from '@/hooks/use-sites';
import { useAlertRules, useDeleteAlertRule, type AlertRuleView } from '@/hooks/use-alert-rules';
import { AlertRuleEditDialog } from './AlertRuleEditDialog';
import { AlertChannel } from '@/types/enums';

export function AlertRulesCard() {
  const { data: sites } = useSites();
  const [siteId, setSiteId] = useState<string>('');
  const activeSiteId = siteId || sites?.[0]?.id || '';
  const { data: rules } = useAlertRules(activeSiteId);
  const deleteRule = useDeleteAlertRule();
  const [editingRule, setEditingRule] = useState<AlertRuleView | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAdd = () => {
    setEditingRule(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (rule: AlertRuleView) => {
    setEditingRule(rule);
    setIsDialogOpen(true);
  };

  const handleDelete = async (rule: AlertRuleView) => {
    if (!confirm(`Xoá quy tắc "${rule.name}"?`)) return;
    try {
      await deleteRule.mutateAsync(rule.id);
      toast('Đã xoá quy tắc cảnh báo', 'success');
    } catch {
      toast('Xoá quy tắc thất bại', 'error');
    }
  };

  return (
    <SettingCard>
      <div className="flex items-center justify-between mb-6">
        <SectionHeader title="Quy tắc cảnh báo" description="Định nghĩa khi nào và gửi cảnh báo cho ai theo từng công trường." />
        <select
          value={activeSiteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-sm outline-none shrink-0"
        >
          {sites?.map((site) => (
            <option key={site.id} value={site.id}>{site.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {rules?.map((rule) => (
          <div key={rule.id} className="flex items-center justify-between p-4 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)]">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-[var(--text-primary)]">{rule.name}</h4>
                {rule.channels.includes(AlertChannel.TELEGRAM) && (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--primary-muted)] text-[var(--primary-light)]">
                    <Send className="w-2.5 h-2.5" /> Telegram
                  </span>
                )}
                {!rule.isActive && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--border)] text-[var(--text-muted)]">Tắt</span>
                )}
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                {rule.recipients.length} người nhận · ngưỡng {rule.threshold} · cooldown {rule.cooldownSec}s
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleEdit(rule)} className="p-2 rounded-lg hover:bg-[var(--surface-hover)]">
                <Pencil className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
              <button onClick={() => handleDelete(rule)} className="p-2 rounded-lg hover:bg-[var(--surface-hover)]">
                <Trash2 className="w-4 h-4 text-[var(--danger)]" />
              </button>
            </div>
          </div>
        ))}
        {rules?.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] text-center py-6">Chưa có quy tắc nào cho công trường này.</p>
        )}
      </div>

      <button
        onClick={handleAdd}
        disabled={!activeSiteId}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50"
      >
        <Plus className="w-4 h-4" /> Thêm quy tắc
      </button>

      <AlertRuleEditDialog
        rule={editingRule}
        siteId={activeSiteId}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </SettingCard>
  );
}
