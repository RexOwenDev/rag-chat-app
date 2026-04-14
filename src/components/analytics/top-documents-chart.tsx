'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface TopDocumentsChartProps {
  data: Array<{ documentId: string; title: string; citationCount: number }>;
}

/** Truncate long document titles for the axis label. */
function truncate(str: string, max = 22): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

export function TopDocumentsChart({ data }: TopDocumentsChartProps) {
  const chartHeight = Math.max(160, data.length * 40);

  return (
    <div style={{ height: chartHeight }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: '#64748b' }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="title"
            width={130}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickFormatter={(v: string) => truncate(v)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0d1424',
              border: '1px solid #1e293b',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: '#e2e8f0' }}
            itemStyle={{ color: '#00d4ff' }}
            formatter={(value) => [value as number, 'Citations']}
          />
          <Bar dataKey="citationCount" radius={[0, 4, 4, 0]}>
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={index === 0 ? '#00d4ff' : `rgba(0,212,255,${0.7 - index * 0.1})`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
