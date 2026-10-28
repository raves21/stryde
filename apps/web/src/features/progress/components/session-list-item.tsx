import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { PRBadge } from '@/components/app/pr-badge'
import type { SessionSummary } from '@/lib/training'
import { formatSpan } from '../use-training'

/** Compact workout row: date block, name, duration, sets, PR count (UI_DESIGN.md §5.3, §5.7). */
export function SessionListItem({ summary }: { summary: SessionSummary }) {
  const { session } = summary
  const day = new Date(`${session.localDate}T00:00:00`)
  return (
    <Link
      to="/workout/$sessionId"
      params={{ sessionId: session.id }}
      className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-3 hover:bg-surface-2"
    >
      <span className="flex w-12 shrink-0 flex-col items-center">
        <span className="tnum font-display text-[28px] leading-none font-bold">
          {format(day, 'd')}
        </span>
        <span className="text-xs text-muted-foreground uppercase">{format(day, 'EEE')}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-semibold">{session.name}</span>
        <span className="tnum text-sm text-muted-foreground">
          {formatSpan(summary.durationMs)} · {summary.sets} {summary.sets === 1 ? 'set' : 'sets'}
        </span>
      </span>
      {summary.prs.length > 0 && <PRBadge count={summary.prs.length} />}
    </Link>
  )
}
