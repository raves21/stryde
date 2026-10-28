import { toDisplayWeight } from '@stryde/shared'
import { createFileRoute, Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Trophy } from 'lucide-react'
import { useState } from 'react'
import { Screen } from '@/components/app/screen'
import { SectionLabel } from '@/components/app/section-label'
import { StatTile } from '@/components/app/stat-tile'
import { TopBar } from '@/components/app/top-bar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DaySheet } from '@/features/progress/components/day-sheet'
import { MonthCalendar } from '@/features/progress/components/month-calendar'
import { YearGrid } from '@/features/progress/components/year-grid'
import { useTraining } from '@/features/progress/use-training'
import { useUnit } from '@/features/settings/use-settings'
import { formatPR } from '@/features/workout/format-pr'
import { computeStats } from '@/lib/training'

export const Route = createFileRoute('/_app/progress')({
  component: ProgressPage,
})

/** Stats, binary calendar, recent PRs (UI_DESIGN.md §5.10). All local, works offline. */
function ProgressPage() {
  const training = useTraining()
  const unit = useUnit()
  const [day, setDay] = useState<string | null>(null)
  if (!training) return null
  const stats = computeStats(training, new Date())
  const volume = (kg: number) => `${toDisplayWeight(kg, unit, 0).toLocaleString()}`

  return (
    <Screen>
      <TopBar title="Progress" />
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="This week" value={String(stats.week)} />
        <StatTile label="This month" value={String(stats.month)} />
        <StatTile label="This year" value={String(stats.year)} />
        <StatTile label="Total workouts" value={String(stats.total)} />
      </div>

      <section
        className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4"
        aria-label="Calendar"
      >
        <Tabs defaultValue="year" className="gap-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="year">Year</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
          <TabsContent value="year">
            <YearGrid trained={training.trainedDates} onSelectDay={setDay} />
          </TabsContent>
          <TabsContent value="month">
            <MonthCalendar trained={training.trainedDates} onSelectDay={setDay} />
          </TabsContent>
        </Tabs>
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Recent PRs</SectionLabel>
        {training.recentPRs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Records start after your second session of an exercise. The first one sets the baseline.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
            {training.recentPRs.slice(0, 5).map((pr) => (
              <li
                key={`${pr.sessionId}-${pr.exercise.id}-${pr.prType}`}
                className="border-border not-last:border-b"
              >
                <Link
                  to="/exercises/$id"
                  params={{ id: pr.exercise.id }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
                >
                  <Trophy className="size-5 shrink-0 text-pr" aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{pr.exercise.name}</span>
                    <span className="tnum truncate text-sm text-pr">{formatPR(pr, unit)}</span>
                  </span>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {format(pr.achievedAt, 'd MMM')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Lifetime</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label={`Volume (${unit})`} value={volume(stats.volumeKg)} />
          <StatTile label={`This month (${unit})`} value={volume(stats.volumeMonthKg)} />
          <StatTile label="Sets" value={stats.totalSets.toLocaleString()} />
        </div>
      </section>

      <DaySheet day={day} training={training} onClose={() => setDay(null)} />
    </Screen>
  )
}
