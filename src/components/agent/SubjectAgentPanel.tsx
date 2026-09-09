// SPDX-License-Identifier: MIT
'use client';
import Link from 'next/link';
import { useAgentEvents, useAgentTasks, useCameraAgents } from '@/hooks/use-agent';
import { AgentTimeline } from './AgentTimeline';
import { AskAgentBox } from './AskAgentBox';

// Trạng thái subagent + trí nhớ đầy đủ của một camera. Dùng chung danh sách
// ['camera-agents'] với lưới thẻ ở /agent, lọc theo id thay vì thêm route chi tiết.
// Chỉ render khi subjectType là camera để modal vi phạm/công trường không phải gọi API này.
function CameraAgentHeader({ cameraId }: { cameraId: string }) {
  const { data: agents, isLoading, isError } = useCameraAgents();
  if (isLoading) return <div className="h-16 rounded-xl bg-[var(--surface-elevated)] animate-pulse" />;
  if (isError) return <p className="text-xs text-[var(--danger)]">Không tải được trạng thái subagent camera.</p>;
  const agent = agents?.find(a => a.cameraId === cameraId);
  if (!agent) return null;
  return (
    <div className="rounded-xl border border-[var(--border)] p-3 space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
        <span className={agent.isEnabled ? 'text-[var(--success)] font-bold' : 'text-[var(--text-muted)] font-bold'}>Subagent: {agent.isEnabled ? 'bật' : 'tắt'}</span>
        <span className="text-[var(--text-secondary)] font-mono">Token hôm nay {agent.tokensUsedToday.toLocaleString('vi-VN')} / {agent.dailyTokenCap.toLocaleString('vi-VN')}</span>
        <span className="text-[var(--text-secondary)]">Digest gần nhất: {agent.lastDigestAt ? new Date(agent.lastDigestAt).toLocaleString('vi-VN') : 'chưa có'}</span>
      </div>
      {agent.memory.length === 0
        ? <p className="text-xs text-[var(--text-muted)]">(chưa có ghi chú)</p>
        : <ul className="space-y-1">
            {agent.memory.map((note, index) => (
              <li key={`${index}-${note.at}`} className="font-mono text-[12px] text-[var(--text-secondary)] break-words">
                <span className="text-[var(--text-muted)]">#{index} {new Date(note.at).toLocaleDateString('vi-VN')}</span> {note.text}
              </li>
            ))}
          </ul>}
    </div>
  );
}

export function SubjectAgentPanel({ subjectType, subjectId }: { subjectType: 'violation' | 'camera' | 'site'; subjectId: string }) {
  const { data: events = [], isLoading, isError: eventsError } = useAgentEvents({ subjectType, subjectId, limit: 20 });
  const { data: tasks = [], isError: tasksError } = useAgentTasks({ status: 'open', subjectType, subjectId });
  // Ô chat đứng TRƯỚC nhật ký: người dùng mở tab Agent để hỏi, không phải để cuộn qua 20 dòng log mới thấy ô nhập.
  return (
    <div className="space-y-4">
      {subjectType === 'camera' && <CameraAgentHeader cameraId={subjectId} />}
      <AskAgentBox subjectType={subjectType} subjectId={subjectId} />
      {tasksError
        ? <p className="text-xs text-[var(--danger)]">Không tải được task chờ.</p>
        : tasks.length > 0 && <p className="text-xs text-[var(--warning)] break-words">Đang chờ: {tasks.map(t => `${t.kind} — ${t.reason}`).join('; ')}</p>}
      <details className="group">
        <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded">
          Nhật ký agent{events.length > 0 ? ` (${events.length} gần nhất)` : ''}
        </summary>
        <div className="mt-2 max-h-72 overflow-y-auto overflow-x-auto pr-1">
          {isLoading
            ? <div className="h-16 rounded-xl bg-[var(--surface-elevated)] animate-pulse" />
            : eventsError
              ? <p className="text-sm text-[var(--danger)]">Không tải được hoạt động của agent.</p>
              : <AgentTimeline events={events} empty="Agent chưa có hoạt động nào với bản ghi này." />}
        </div>
        <Link href="/agent" className="mt-2 inline-block text-xs text-[var(--primary)] hover:underline">Xem toàn bộ nhật ký trên trang Agent →</Link>
      </details>
    </div>
  );
}
