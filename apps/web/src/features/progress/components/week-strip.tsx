import { format } from 'date-fns'
import { Check } from 'lucide-react'
import { dayKey, weekDays } from '@/lib/training'
import { cn } from '@/lib/utils'

/** Mon–Sun circles; trained days filled volt with a check, today outlined (UI_DESIGN.md §5.3). */
export function WeekStrip({ trained, today = new Date() }: { trained: Set<string>; today?: Date }) {
  const days = weekDays(today)
  const todayKey = dayKey(today)
  const count = days.filter((d) => trained.has(d)).length
  return (
    <div className="flex flex-col gap-2">
      <ol className="grid grid-cols-7 gap-1" aria-label="This week">
        {days.map((d) => {
          const done = trained.has(d)
          const date = new Date(`${d}T00:00:00`)
          return (
            <li key={d} className="flex flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground">{format(date, 'EEEEE')}</span>
              <span
                className={cn(
                  'flex size-9 items-center justify-center rounded-full text-sm',
                  done ? 'bg-brand text-primary-foreground' : 'bg-surface-3 text-faint',
                  d === todayKey && !done && 'ring-2 ring-foreground/60',
                )}
              >
                {done ? (
                  <Check className="size-4" strokeWidth={3} aria-hidden />
                ) : (
                  <span aria-hidden>{format(date, 'd')}</span>
                )}
                <span className="sr-only">{`${format(date, 'EEEE')}${done ? ', trained' : ''}`}</span>
              </span>
            </li>
          )
        })}
      </ol>
      <p className="text-sm text-muted-foreground">
        {count === 0
          ? 'No workouts yet this week'
          : `${count} ${count === 1 ? 'workout' : 'workouts'} this week`}
      </p>
    </div>
  )
}
