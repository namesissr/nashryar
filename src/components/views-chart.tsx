'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { faNum } from '@/lib/utils';

export function ViewsChart({
  series,
  sites,
}: {
  series: ({ date: string; total: number } & Record<string, number | string>)[];
  sites: { key: string; name: string; color: string }[];
}) {
  const data = series.map((r) => ({
    ...r,
    label: new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric' }).format(new Date(r.date)),
  }));

  return (
    <div dir="ltr" className="h-72 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {sites.map((s) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11 }} width={36} allowDecimals={false} />
          <Tooltip
            formatter={(value: number | string, name: string) => [
              faNum(Number(value)),
              sites.find((s) => s.key === name)?.name || name,
            ]}
            labelStyle={{ direction: 'rtl' }}
            contentStyle={{ borderRadius: 12, fontFamily: 'inherit' }}
          />
          <Legend formatter={(v: string) => sites.find((s) => s.key === v)?.name || v} />
          {sites.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#grad-${s.key})`}
              stackId="views"
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
