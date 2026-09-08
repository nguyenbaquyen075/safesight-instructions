// SPDX-License-Identifier: MIT
'use client';
import { Brain, Eraser, Sparkles } from 'lucide-react';
import { InputGroup, SettingCard, Switch } from '@/components/settings/ui';
import { useDigestCamera, useSaveCameraAgent } from '@/hooks/use-agent';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { CameraAgentUpdate, CameraAgentView } from '@/types/agent';

const BTN = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed';
const CHIP = 'px-2 py-0.5 rounded-md border border-[var(--border)] text-[10px] text-[var(--text-muted)]';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
      <p className="text-sm font-bold mt-0.5 break-words">{value}</p>
    </div>
  );
}

export function CameraAgentCard({ agent }: { agent: CameraAgentView }) {
  const save = useSaveCameraAgent();
  const digest = useDigestCamera();

  const update = (data: CameraAgentUpdate) =>
    save.mutate({ cameraId: agent.cameraId, ...data }, {
      onSuccess: () => toast('Đã lưu subagent camera', 'success'),
      onError: () => toast('Lưu subagent camera thất bại', 'error'),
    });

  const runDigest = () =>
    digest.mutate(agent.cameraId, {
      onSuccess: r => toast(`Đã xếp lượt tổng hợp (task ${r.taskId})`, 'success'),
      onError: () => toast('Không xếp được lượt tổng hợp', 'error'),
    });

  const clearMemory = () => {
    if (!window.confirm(`Xoá toàn bộ trí nhớ của camera "${agent.name}"? Không khôi phục được.`)) return;
    update({ clearMemory: true });
  };

  // Trần 0 nghĩa là chặn hẳn: coi như đã đầy để thanh không chia cho 0.
  const usedRatio = agent.dailyTokenCap > 0 ? Math.min(1, agent.tokensUsedToday / agent.dailyTokenCap) : 1;
  // 3 ghi chú mới nhất, giữ chỉ số gốc để khớp replaceIndex mà agent dùng.
  const notes = agent.memory.map((note, index) => ({ note, index })).slice(-3).reverse();

  return (
    <SettingCard className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h4 className="font-black break-words">{agent.name}</h4>
          <p className="text-xs text-[var(--text-muted)] break-words">{agent.siteName}</p>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {agent.cameraStatus !== 'online' && <span className={CHIP}>{agent.cameraStatus === 'offline' ? 'offline' : agent.cameraStatus}</span>}
          {!agent.exists && <span className={CHIP} title="Chưa có dòng CameraAgent, đang hiển thị giá trị mặc định">mặc định</span>}
        </div>
      </div>

      <Switch enabled={agent.isEnabled} onChange={v => update({ isEnabled: v })} label="Bật subagent" description="Tắt: camera này không chạy phiên nào." />

      {/* key theo giá trị server để input remount sau refetch; onBlur để không PATCH mỗi lần gõ. */}
      <InputGroup label="Nhịp tổng hợp (phút)" description="5–1440 phút giữa hai lượt tổng hợp tự động.">
        <input
          key={`digest-${agent.cameraId}-${agent.digestEveryMin}`}
          type="number" min={5} max={1440} defaultValue={agent.digestEveryMin}
          onBlur={e => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 5 && v <= 1440 && v !== agent.digestEveryMin) update({ digestEveryMin: v }); }}
          className="w-full rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        />
      </InputGroup>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Token hôm nay</p>
          <p className="text-xs font-mono text-[var(--text-secondary)]">{agent.tokensUsedToday.toLocaleString('vi-VN')} / {agent.dailyTokenCap.toLocaleString('vi-VN')}</p>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-[var(--surface-elevated)] overflow-hidden">
          <div className={cn('h-full rounded-full transition-[width]', usedRatio > 0.8 ? 'bg-[var(--warning)]' : 'bg-[var(--primary)]')} style={{ width: `${usedRatio * 100}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Digest gần nhất" value={agent.lastDigestAt ? new Date(agent.lastDigestAt).toLocaleString('vi-VN') : 'chưa có'} />
        <Stat label="Vi phạm mở" value={String(agent.openViolations)} />
        <Stat label="Báo oan 24h" value={`${Math.round(agent.falsePositiveRate24h * 100)}%`} />
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-1.5"><Brain className="w-3 h-3" /> Trí nhớ</p>
        {notes.length === 0
          ? <p className="text-xs text-[var(--text-muted)] mt-1">(chưa có ghi chú)</p>
          : <ul className="mt-1 space-y-1">
              {notes.map(({ note, index }) => (
                <li key={`${index}-${note.at}`} className="font-mono text-[12px] text-[var(--text-secondary)] break-words">
                  <span className="text-[var(--text-muted)]">#{index} {new Date(note.at).toLocaleDateString('vi-VN')}</span> {note.text}
                </li>
              ))}
            </ul>}
      </div>

      <div className="flex gap-2 flex-wrap mt-auto">
        <button type="button" onClick={runDigest} disabled={!agent.isEnabled || digest.isPending} className={cn(BTN, 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]')}>
          <Sparkles className="w-3.5 h-3.5" /> Tổng hợp ngay
        </button>
        <button type="button" onClick={clearMemory} disabled={agent.memory.length === 0 || save.isPending} className={cn(BTN, 'border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]')}>
          <Eraser className="w-3.5 h-3.5" /> Xoá trí nhớ
        </button>
      </div>
    </SettingCard>
  );
}
