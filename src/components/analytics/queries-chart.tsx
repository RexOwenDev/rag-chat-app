'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface QueriesChartProps {
  data: Array<{ date: string; count: number }>;
}

export function QueriesChart({ data }: QueriesChartProps) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="queryGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickFormatter={(v: string) => v.slice(5)} // MM-DD
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: '#64748b' }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0d1424',
              border: '1px solid #1e293b',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: '#94a3b8' }}
            itemStyle={{ color: '#00d4ff' }}
            labelFormatter={(label) => `Date: ${String(label)}`}
            formatter={(value) => [value as number, 'Queries']}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#00d4ff"
            strokeWidth={2}
            fill="url(#queryGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
