// SPDX-License-Identifier: MIT
'use client';
import { useState } from 'react';
import { Bot, Activity, ListTodo, Settings2 } from 'lucide-react';
import { SectionHeader, SettingCard, InputGroup, Switch } from '@/components/settings/ui';
import { AgentTimeline } from '@/components/agent/AgentTimeline';
import { AskAgentBox } from '@/components/agent/AskAgentBox';
import { useAgentEvents, useAgentSettings, useAgentTasks, useSaveAgentSettings } from '@/hooks/use-agent';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const FILTERS = [['', 'Tất cả'], ['verdict', 'Phán quyết'], ['action', 'Hành động'], ['health', 'Sức khoẻ'], ['error', 'Lỗi']] as const;
// Gợi ý sẵn; admin vẫn gõ được tên model bất kỳ (proxy tương thích OpenAI dùng tên riêng).
const MODELS = ['claude-opus-5', 'claude-sonnet-5'];

export default function AgentPage() {
  const [type, setType] = useState<string>('');
  const { data: events = [], isLoading, isError } = useAgentEvents({ type: type || undefined, limit: 150 });
  const { data: open = [], isLoading: tasksLoading, isError: tasksError } = useAgentTasks({ status: 'open', limit: 30 });
  const { data: settings, isLoading: settingsLoading, isError: settingsError } = useAgentSettings();
  const save = useSaveAgentSettings();
  const sweep = events.find(e => e.type === 'health');

  const update = (data: Parameters<typeof save.mutate>[0]) => save.mutate(data, { onSuccess: () => toast('Đã lưu cài đặt agent', 'success'), onError: () => toast('Lưu thất bại', 'error') });

  return (
    <div className="space-y-8 pb-20 animate-fade-up">
      <SectionHeader title="Agent giám sát" description="Trực vận hành tất định + cán bộ an toàn tự động. Mọi hành động đều có lý do và được ghi lại." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SettingCard><p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Trạng thái</p><p className="text-2xl font-black mt-1">{settings ? (settings.isEnabled ? 'Đang chạy' : 'Tạm dừng') : '…'}</p></SettingCard>
        <SettingCard><p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Task đang chờ</p><p className="text-2xl font-black mt-1">{open.length}</p></SettingCard>
        <SettingCard><p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Sweep gần nhất</p><p className="text-sm font-bold mt-1">{sweep ? new Date(sweep.emittedAt).toLocaleTimeString('vi-VN') : 'chưa có'}</p></SettingCard>
        <SettingCard><p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Model</p><p className="text-sm font-bold mt-1">{settings?.model ?? '…'}</p></SettingCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SettingCard className="lg:col-span-2">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <h3 className="font-black flex items-center gap-2"><Activity className="w-4 h-4" /> Dòng thời gian</h3>
            <div className="flex gap-1 overflow-x-auto">
              {FILTERS.map(([v, label]) => (
                <button key={v} onClick={() => setType(v)} className={cn('px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]', type === v ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]')}>{label}</button>
              ))}
            </div>
          </div>
          {isLoading ? <div className="h-24 rounded-xl bg-[var(--surface-elevated)] animate-pulse" /> : isError ? <p className="text-sm text-[var(--danger)]">Không tải được nhật ký.</p> : <div className="overflow-x-auto"><AgentTimeline events={events} /></div>}
        </SettingCard>

        <div className="space-y-6">
          <SettingCard>
            <h3 className="font-black flex items-center gap-2 mb-3"><ListTodo className="w-4 h-4" /> Hàng đợi</h3>
            {tasksLoading ? <div className="h-16 rounded-xl bg-[var(--surface-elevated)] animate-pulse" /> : tasksError ? <p className="text-sm text-[var(--danger)]">Không tải được hàng đợi.</p> : open.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Không có task chờ.</p> : (
              <ul className="space-y-2 text-sm">
                {open.map(t => <li key={t.id} className="break-words"><span className="font-mono text-[10px] text-[var(--text-muted)]">{t.kind}</span> · {t.reason} <span className="text-[var(--text-muted)]">({new Date(t.dueAt).toLocaleTimeString('vi-VN')})</span></li>)}
              </ul>
            )}
          </SettingCard>

          <SettingCard>
            <h3 className="font-black flex items-center gap-2 mb-3"><Settings2 className="w-4 h-4" /> Cài đặt</h3>
            {settingsLoading ? <div className="h-40 rounded-xl bg-[var(--surface-elevated)] animate-pulse" /> : settingsError ? <p className="text-sm text-[var(--danger)]">Không tải được cài đặt.</p> : settings && (
              <div className="space-y-4">
                <Switch enabled={settings.isEnabled} onChange={v => update({ isEnabled: v })} label="Bật agent" description="Tắt: chỉ ghi nhận, không hành động." />
                <InputGroup label="Model"><input key={`model-${settings.model}`} list="agent-models" defaultValue={settings.model} onBlur={e => { const v = e.target.value.trim(); if (v && v !== settings.model) update({ model: v }); }} className="w-full rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] px-3 py-2 text-sm" /><datalist id="agent-models">{[...new Set([...MODELS, settings.model])].map(m => <option key={m} value={m} />)}</datalist></InputGroup>
                <InputGroup label="Độ kỹ khi review"><select value={settings.reviewEffort} onChange={e => update({ reviewEffort: e.target.value })} className="w-full rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] px-3 py-2 text-sm"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select></InputGroup>
                {/* key theo giá trị server để input tự remount sau refetch, tránh lưu lại giá trị cũ trong DOM */}
                <InputGroup label="Trần token / ngày"><input key={`cap-${settings.dailyTokenCap}`} type="number" defaultValue={settings.dailyTokenCap} onBlur={e => { const v = Number(e.target.value); if (Number.isFinite(v) && v !== settings.dailyTokenCap) update({ dailyTokenCap: v }); }} className="w-full rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] px-3 py-2 text-sm" /></InputGroup>
                <InputGroup label="Giờ báo cáo ca"><input key={`shift-${settings.shiftReportAt}`} type="time" defaultValue={settings.shiftReportAt} onBlur={e => { if (e.target.value !== settings.shiftReportAt) update({ shiftReportAt: e.target.value }); }} className="w-full rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] px-3 py-2 text-sm" /></InputGroup>
              </div>
            )}
          </SettingCard>
        </div>
      </div>

      <SettingCard>
        <h3 className="font-black flex items-center gap-2 mb-3"><Bot className="w-4 h-4" /> Hỏi agent</h3>
        <AskAgentBox subjectType="system" />
      </SettingCard>
    </div>
  );
}
