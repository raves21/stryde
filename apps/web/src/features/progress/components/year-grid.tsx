import { addDays, format, startOfWeek, subWeeks } from 'date-fns'
import { useEffect, useRef } from 'react'
import { dayKey } from '@/lib/training'
import { cn } from '@/lib/utils'

const WEEKS = 53

/**
 * GitHub-style year: 53 columns × 7 rows (Mon–Sun), binary trained / not trained, month
 * labels, scrolled to the current week (UI_DESIGN.md §5.10).
 */
export function YearGrid({
  trained,
  onSelectDay,
  today = new Date(),
}: {
  trained: Set<string>
  onSelectDay: (day: string) => void
  today?: Date
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const first = startOfWeek(subWeeks(today, WEEKS - 1), { weekStartsOn: 1 })
  const todayKey = dayKey(today)
  const weeks = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d)),
  )

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  return (
    <div className="flex gap-1.5">
      <div
        className="grid grid-rows-[16px_repeat(7,11px)] gap-[3px] text-[10px] text-faint"
        aria-hidden
      >
        <span />
        {['M', '', 'W', '', 'F', '', ''].map((l, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed weekday rows
          <span key={i} className="leading-[11px]">
            {l}
          </span>
        ))}
      </div>
      <div ref={scroller} className="overflow-x-auto [scrollbar-width:none]">
        <div className="flex gap-[3px]">
          {weeks.map((days) => {
            const firstOfMonth = days.find((d) => d.getDate() === 1)
            return (
              <div
                key={dayKey(days[0] ?? first)}
                className="grid grid-rows-[16px_repeat(7,11px)] gap-[3px]"
              >
                <span className="w-[11px] overflow-visible text-[10px] whitespace-nowrap text-faint">
                  {firstOfMonth ? format(firstOfMonth, 'MMM') : ''}
                </span>
                {days.map((d) => {
                  const key = dayKey(d)
                  const future = key > todayKey
                  const done = trained.has(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={future}
                      onClick={() => onSelectDay(key)}
                      aria-label={`${format(d, 'EEEE d MMMM yyyy')}${done ? ', trained' : ''}`}
                      className={cn(
                        'size-[11px] rounded-[2px]',
                        done ? 'bg-brand' : 'bg-surface-3',
                        future && 'opacity-30',
                      )}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
