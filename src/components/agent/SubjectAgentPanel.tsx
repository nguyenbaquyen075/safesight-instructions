// SPDX-License-Identifier: MIT
'use client';
import { useAgentEvents, useAgentTasks } from '@/hooks/use-agent';
import { AgentTimeline } from './AgentTimeline';
import { AskAgentBox } from './AskAgentBox';

export function SubjectAgentPanel({ subjectType, subjectId }: { subjectType: 'violation' | 'camera' | 'site'; subjectId: string }) {
  const { data: events = [], isLoading, isError: eventsError } = useAgentEvents({ subjectType, subjectId, limit: 20 });
  const { data: tasks = [], isError: tasksError } = useAgentTasks({ status: 'open', subjectType, subjectId });
  return (
    <div className="space-y-4">
      {tasksError
        ? <p className="text-xs text-[var(--danger)]">Không tải được task chờ.</p>
        : tasks.length > 0 && <p className="text-xs text-[var(--warning)]">Đang chờ: {tasks.map(t => `${t.kind} — ${t.reason}`).join('; ')}</p>}
      {isLoading
        ? <div className="h-16 rounded-xl bg-[var(--surface-elevated)] animate-pulse" />
        : eventsError
          ? <p className="text-sm text-[var(--danger)]">Không tải được hoạt động của agent.</p>
          : <div className="overflow-x-auto"><AgentTimeline events={events} empty="Agent chưa có hoạt động nào với bản ghi này." /></div>}
      <AskAgentBox subjectType={subjectType} subjectId={subjectId} />
    </div>
  );
}
