import { toDisplayWeight } from '@stryde/shared'
import { createFileRoute, Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { ChevronRight, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Screen } from '@/components/app/screen'
import { SectionLabel } from '@/components/app/section-label'
import { StatTile } from '@/components/app/stat-tile'
import { TopBar } from '@/components/app/top-bar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DaySheet } from '@/features/progress/components/day-sheet'
import { MonthCalendar } from '@/features/progress/components/month-calendar'
import { SessionListItem } from '@/features/progress/components/session-list-item'
import { YearGrid } from '@/features/progress/components/year-grid'
import { formatSpan, useTraining } from '@/features/progress/use-training'
import { useUnit } from '@/features/settings/use-settings'
import { formatPR } from '@/features/workout/format-pr'
import { computeSportStats, computeStats } from '@/lib/training'

export const Route = createFileRoute('/_app/progress')({
  component: ProgressPage,
})

/**
 * Stats, binary calendar, recent PRs (UI_DESIGN.md §5.10). All local, works offline. Sports
 * have their own tab (once you've played one): their numbers never mix with the gym's, but
 * the calendar shows every day you were active.
 */
function ProgressPage() {
  const training = useTraining()
  const unit = useUnit()
  const [day, setDay] = useState<string | null>(null)
  if (!training) return null
  const stats = computeStats(training, new Date())
  const sports = computeSportStats(training, new Date())
  const hasSports = training.sessions.some((s) => s.sport)
  const volume = (kg: number) => `${toDisplayWeight(kg, unit, 0).toLocaleString()}`

  const calendar = (
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
  )

  const gym = (
    <>
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="This week" value={String(stats.week)} />
        <StatTile label="This month" value={String(stats.month)} />
        <StatTile label="This year" value={String(stats.year)} />
        <StatTile label="Total workouts" value={String(stats.total)} />
      </div>

      {calendar}

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
    </>
  )

  const sportSessions = training.sessions.filter((s) => s.sport)
  const sportsView = (
    <>
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Played this week" value={formatSpan(sports.playMsWeek)} />
        <StatTile label="Played this month" value={formatSpan(sports.playMsMonth)} />
        <StatTile label="Sessions" value={String(sports.sessionsTotal)} />
        <StatTile label="Games" value={String(sports.gamesTotal)} />
      </div>

      {calendar}

      <section className="flex flex-col gap-2">
        <SectionLabel>By sport</SectionLabel>
        <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
          {sports.bySport.map((s) => (
            <li key={s.exercise.id} className="border-border not-last:border-b">
              <Link
                to="/exercises/$id"
                params={{ id: s.exercise.id }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{s.exercise.name}</span>
                  <span className="tnum truncate text-sm text-muted-foreground">
                    {s.sessions} {s.sessions === 1 ? 'session' : 'sessions'} · {s.games}{' '}
                    {s.games === 1 ? 'game' : 'games'} · {formatSpan(s.playMs)}
                  </span>
                </span>
                <ChevronRight className="size-5 text-faint" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Recent sessions</SectionLabel>
        {sportSessions.slice(0, 5).map((s) => (
          <SessionListItem key={s.session.id} summary={s} />
        ))}
      </section>
    </>
  )

  return (
    <Screen>
      <TopBar title="Progress" />
      {hasSports ? (
        <Tabs defaultValue="gym" className="gap-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="gym">Gym</TabsTrigger>
            <TabsTrigger value="sports">Sports</TabsTrigger>
          </TabsList>
          <TabsContent value="gym" className="flex flex-col gap-6">
            {gym}
          </TabsContent>
          <TabsContent value="sports" className="flex flex-col gap-6">
            {sportsView}
          </TabsContent>
        </Tabs>
      ) : (
        gym
      )}
      <DaySheet day={day} training={training} onClose={() => setDay(null)} />
    </Screen>
  )
}
