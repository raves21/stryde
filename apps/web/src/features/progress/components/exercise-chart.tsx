import type { ChartMetric, ChartPoint, WeightUnit } from '@stryde/shared'
import { format } from 'date-fns'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { type ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { displayValue, formatMetric, METRIC_LABELS } from '../metrics'

type Datum = ChartPoint & { y: number }

/**
 * Progress line (UI_DESIGN.md §5.9): accent line, 2px, dots per session, gold dots on
 * PR points, minimal grid, muted axes, tooltip with date + value.
 */
export function ExerciseChart({
  points,
  metric,
  unit,
}: {
  points: ChartPoint[]
  metric: ChartMetric
  unit: WeightUnit
}) {
  const data: Datum[] = points.map((p) => ({ ...p, y: displayValue(metric, p.value, unit) }))
  const config = {
    y: { label: METRIC_LABELS[metric], color: 'var(--accent-brand)' },
  } satisfies ChartConfig

  return (
    <ChartContainer config={config} className="aspect-[16/10] w-full">
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          tickFormatter={(d: string) => format(new Date(`${d}T00:00:00`), 'd MMM')}
        />
        <YAxis
          width={40}
          tickLine={false}
          axisLine={false}
          domain={['auto', 'auto']}
          allowDecimals={false}
        />
        <ChartTooltip
          cursor={false}
          content={({ active, payload }) => {
            const d = payload?.[0]?.payload as Datum | undefined
            if (!active || !d) return null
            return (
              <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
                <p className="text-muted-foreground">
                  {format(new Date(`${d.date}T00:00:00`), 'EEE d MMM yyyy')}
                </p>
                <p className="tnum font-semibold">
                  {formatMetric(metric, d.value, unit)}
                  {d.isPR && <span className="ml-1 text-pr">· PR</span>}
                </p>
              </div>
            )
          }}
        />
        <Line
          type="monotone"
          dataKey="y"
          stroke="var(--color-y)"
          strokeWidth={2}
          isAnimationActive={false}
          dot={(props: { cx?: number; cy?: number; payload?: Datum; index?: number }) => (
            <circle
              key={props.index}
              cx={props.cx}
              cy={props.cy}
              r={props.payload?.isPR ? 5 : 3}
              fill={props.payload?.isPR ? 'var(--pr)' : 'var(--accent-brand)'}
              stroke="var(--surface)"
              strokeWidth={1.5}
            />
          )}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ChartContainer>
  )
}
