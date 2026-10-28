import { createFileRoute } from '@tanstack/react-router'
import { format } from 'date-fns'
import { History } from 'lucide-react'
import { EmptyState } from '@/components/app/empty-state'
import { Screen } from '@/components/app/screen'
import { TopBar } from '@/components/app/top-bar'
import { SessionListItem } from '@/features/progress/components/session-list-item'
import { useTraining } from '@/features/progress/use-training'
import type { SessionSummary } from '@/lib/training'

export const Route = createFileRoute('/_app/history')({
  component: HistoryPage,
})

/** Reverse-chronological, grouped by month with sticky headers (UI_DESIGN.md §5.7). */
function HistoryPage() {
  const training = useTraining()
  const months = new Map<string, SessionSummary[]>()
  for (const s of training?.sessions ?? []) {
    const key = s.session.localDate.slice(0, 7)
    months.set(key, [...(months.get(key) ?? []), s])
  }

  return (
    <Screen>
      <TopBar title="History" back />
      {training && training.sessions.length === 0 ? (
        <EmptyState icon={History} title="No workouts yet. Your first one sets the baseline." />
      ) : (
        [...months].map(([month, sessions]) => (
          <section key={month} className="flex flex-col gap-2">
            <h2 className="sticky top-14 z-10 -mx-4 bg-background px-4 py-2 font-display text-[13px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              {format(new Date(`${month}-01T00:00:00`), 'MMMM yyyy')}
            </h2>
            {sessions.map((s) => (
              <SessionListItem key={s.session.id} summary={s} />
            ))}
          </section>
        ))
      )}
    </Screen>
  )
}
