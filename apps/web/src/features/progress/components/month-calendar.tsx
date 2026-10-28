import { addDays, addMonths, endOfMonth, format, startOfMonth, startOfWeek } from 'date-fns'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { dayKey } from '@/lib/training'
import { cn } from '@/lib/utils'

/** Month grid: trained days are volt circles with a check, today outlined (UI_DESIGN.md §5.10). */
export function MonthCalendar({
  trained,
  onSelectDay,
  today = new Date(),
}: {
  trained: Set<string>
  onSelectDay: (day: string) => void
  today?: Date
}) {
  const [month, setMonth] = useState(() => startOfMonth(today))
  const start = startOfWeek(month, { weekStartsOn: 1 })
  const end = endOfMonth(month)
  const days: Date[] = []
  for (let d = start; d <= end || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d)
  const todayKey = dayKey(today)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous month"
          onClick={() => setMonth((m) => addMonths(m, -1))}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <span className="font-semibold">{format(month, 'MMMM yyyy')}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next month"
          disabled={dayKey(addMonths(month, 1)) > todayKey}
          onClick={() => setMonth((m) => addMonths(m, 1))}
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed weekday header
          <span key={i} className="text-xs text-faint">
            {l}
          </span>
        ))}
        {days.map((d) => {
          const key = dayKey(d)
          const inMonth = d.getMonth() === month.getMonth()
          const done = trained.has(key)
          return (
            <span key={key} className="flex justify-center">
              <button
                type="button"
                disabled={!inMonth || key > todayKey}
                onClick={() => onSelectDay(key)}
                aria-label={`${format(d, 'EEEE d MMMM')}${done ? ', trained' : ''}`}
                className={cn(
                  'tnum flex size-10 items-center justify-center rounded-full text-sm',
                  !inMonth && 'invisible',
                  done ? 'bg-brand text-primary-foreground' : 'text-muted-foreground',
                  key === todayKey && !done && 'ring-2 ring-foreground/60',
                )}
              >
                {done ? <Check className="size-4" strokeWidth={3} /> : d.getDate()}
              </button>
            </span>
          )
        })}
      </div>
    </div>
  )
}
