'use client';
// SPDX-License-Identifier: MIT


import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { ComplianceTrendPoint } from '@/types/models';

interface ComplianceChartProps {
  data: ComplianceTrendPoint[];
}

export function ComplianceChart({ data }: ComplianceChartProps) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="complianceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickFormatter={(val: string) => {
              const d = new Date(val);
              return `${d.getDate()}/${d.getMonth() + 1}`;
            }}
            interval={4}
          />
          <YAxis
            domain={[75, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickFormatter={(val: number) => `${val}%`}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '13px',
            }}
            formatter={(value: any) => [`${typeof value === 'number' ? value.toFixed(1) : value}%`, 'Compliance']}
            labelFormatter={(label: any) => {
              const d = new Date(label);
              return d.toLocaleDateString('vi-VN', {
                day: 'numeric',
                month: 'short',
              });
            }}
          />
          <Area
            type="monotone"
            dataKey="rate"
            stroke="#2563EB"
            strokeWidth={2}
            fill="url(#complianceGradient)"
            dot={false}
            activeDot={{
              r: 5,
              fill: '#2563EB',
              stroke: 'var(--background)',
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
