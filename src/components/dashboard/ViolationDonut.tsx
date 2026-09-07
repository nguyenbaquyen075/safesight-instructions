'use client';
// SPDX-License-Identifier: MIT


import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { ViolationBreakdown } from '@/types/models';

interface ViolationDonutProps {
  data: ViolationBreakdown[];
}

export function ViolationDonut({ data }: ViolationDonutProps) {
  return (
    <div className="flex flex-col h-[280px]">
      <div className="flex-1 min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="65%"
              outerRadius="90%"
              paddingAngle={2}
              dataKey="count"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '13px',
              }}
              itemStyle={{ color: 'var(--text-primary)' }}
              formatter={(value, _name, props) => [
                `${value} (${props.payload.percentage.toFixed(1)}%)`,
                props.payload.label,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-[var(--text-primary)]">
            {data.reduce((sum, item) => sum + item.count, 0)}
          </span>
          <span className="text-xs text-[var(--text-muted)]">Total</span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-2 mt-4 overflow-y-auto pr-2 max-h-[80px]">
        {data.slice(0, 6).map((item) => (
          <div key={item.type} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-[var(--text-secondary)] truncate" title={item.label}>
              {item.label}
            </span>
            <span className="text-xs font-medium text-[var(--text-primary)] ml-auto">
              {item.percentage.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
