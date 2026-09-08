'use client';
// SPDX-License-Identifier: MIT

import { hourWeekdayGrid, maxCell } from '@/lib/heatmap-shape';

// Nhãn thứ khớp Date.getDay() (0 = Chủ nhật) — cùng quy ước viết tắt/đầy đủ với
// WEEKDAY_OPTIONS trong src/app/(dashboard)/agent/page.tsx.
const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEKDAY_FULL = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Lưới 7×24 số vi phạm theo giờ trong ngày × thứ trong tuần, tô đậm theo `--danger`. */
export function TimeHeatmap({ violations }: { violations: { detectedAt: string }[] }) {
  const grid = hourWeekdayGrid(violations);
  const max = maxCell(grid);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="min-w-[620px]">
          <div className="grid grid-cols-[40px_repeat(24,1fr)] gap-[2px] mb-1">
            <div />
            {HOURS.map((h) => (
              <div key={h} className="text-center text-[9px] text-[var(--text-muted)]">
                {h % 3 === 0 ? h : ''}
              </div>
            ))}
          </div>
          {WEEKDAY_SHORT.map((label, day) => (
            <div key={label} className="grid grid-cols-[40px_repeat(24,1fr)] gap-[2px] mb-[2px]">
              <div className="text-[10px] font-bold text-[var(--text-muted)] flex items-center">{label}</div>
              {HOURS.map((h) => {
                const count = grid[day][h];
                const alpha = max > 0 && count > 0 ? 0.12 + 0.78 * (count / max) : 0;
                return (
                  <div
                    key={h}
                    title={`${WEEKDAY_FULL[day]}, ${h}:00 — ${count} vi phạm`}
                    className="aspect-square rounded-sm"
                    style={{ background: count > 0 ? `rgba(220, 38, 38, ${alpha})` : 'var(--background-secondary)' }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {max === 0 && (
        <p className="text-xs text-[var(--text-muted)]">Chưa có vi phạm nào trong khoảng thời gian đã chọn.</p>
      )}
    </div>
  );
}
