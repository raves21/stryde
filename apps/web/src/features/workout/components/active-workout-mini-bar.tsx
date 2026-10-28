import { Link } from '@tanstack/react-router'
import { ChevronUp } from 'lucide-react'
import { useNow } from '@/lib/use-now'
import { formatElapsed } from '@/lib/workout'
import { useRestTimer } from '../rest-timer'
import { useActiveSession } from '../use-workout'

/** Slim bar above the tab bar while a workout runs (UI_DESIGN.md §3). */
export function ActiveWorkoutMiniBar() {
  const session = useActiveSession()
  const rest = useRestTimer()
  const now = useNow(1000, !!session)
  if (!session) return null
  const restLeft = rest ? Date.parse(rest.endsAt) - now : 0

  return (
    <Link
      to="/workout/active"
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface-2"
    >
      <div className="mx-auto flex h-12 max-w-[640px] items-center gap-3 px-4">
        <span className="size-2 shrink-0 rounded-full bg-brand" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium">{session.name}</span>
        {restLeft > 0 && (
          <span className="tnum text-sm text-brand">
            Rest {formatElapsed(Math.ceil(restLeft / 1000) * 1000)}
          </span>
        )}
        <span className="tnum text-sm text-muted-foreground">
          {formatElapsed(now - Date.parse(session.startedAt))}
        </span>
        <ChevronUp className="size-5 text-faint" aria-label="Open workout" />
      </div>
    </Link>
  )
}
