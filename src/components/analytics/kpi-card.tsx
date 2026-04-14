'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  icon: React.ReactNode;
  className?: string;
}

export function KpiCard({ title, value, trend, trendLabel, icon, className }: KpiCardProps) {
  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  const trendColor =
    trend === 'up'
      ? 'text-emerald-400'
      : trend === 'down'
        ? 'text-red-400'
        : 'text-muted-foreground';

  return (
    <Card className={cn('bg-card', className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">
              {value}
            </p>
            {trendLabel && (
              <div className={cn('mt-1 flex items-center gap-1 text-xs', trendColor)}>
                <TrendIcon className="h-3 w-3" />
                <span>{trendLabel}</span>
              </div>
            )}
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
