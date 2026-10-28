import {
  CHART_METRICS,
  type ChartMetric,
  type ExerciseRow,
  seriesForChart,
  sessionMetric,
} from '@stryde/shared'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { format, subDays, subMonths, subYears } from 'date-fns'
import { Archive, ChartLine, Pencil, SearchX, Trophy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { EmptyState } from '@/components/app/empty-state'
import { Screen } from '@/components/app/screen'
import { SectionLabel } from '@/components/app/section-label'
import { TopBar } from '@/components/app/top-bar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { deleteExercise } from '@/db/repositories/exercises'
import { ExerciseFormSheet } from '@/features/exercises/components/exercise-form-sheet'
import {
  EQUIPMENT_LABELS,
  EXERCISE_TYPE_LABELS,
  formatDuration,
  MUSCLE_GROUP_LABELS,
} from '@/features/exercises/labels'
import { useExercise } from '@/features/exercises/use-exercises'
import { ExerciseChart } from '@/features/progress/components/exercise-chart'
import { formatMetric, HEADLINE, METRIC_LABELS } from '@/features/progress/metrics'
import { useTraining } from '@/features/progress/use-training'
import { useUnit } from '@/features/settings/use-settings'
import { formatPR } from '@/features/workout/format-pr'
import { dayKey, type ExerciseHistory } from '@/lib/training'
import { cn } from '@/lib/utils'
import { formatSetLine } from '@/lib/workout'

export const Route = createFileRoute('/_app/exercises/$id')({
  component: ExerciseDetailPage,
})

const RANGES = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12, All: null } as const
type Range = keyof typeof RANGES

function ExerciseDetailPage() {
  const { id } = Route.useParams()
  const exercise = useExercise(id)
  const training = useTraining()
  if (exercise === undefined || !training) return null
  if (exercise === null) {
    return (
      <Screen>
        <TopBar title="Exercise" back />
        <EmptyState icon={SearchX} title="This exercise doesn't exist or was archived." />
      </Screen>
    )
  }
  return <ExerciseDetail exercise={exercise} history={training.exercises.get(id)} />
}

/** Exercise detail: headline, chart, records, history (UI_DESIGN.md §5.9). */
function ExerciseDetail({
  exercise,
  history,
}: {
  exercise: ExerciseRow
  history: ExerciseHistory | undefined
}) {
  const navigate = useNavigate()
  const unit = useUnit()
  const metrics: readonly ChartMetric[] = CHART_METRICS[exercise.type]
  const [metric, setMetric] = useState<ChartMetric>(HEADLINE[exercise.type])
  const [range, setRange] = useState<Range>('3M')
  const [editing, setEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const today = new Date()
  const sessions = history?.sessions ?? []

  const months = RANGES[range]
  const from =
    months === null
      ? undefined
      : dayKey(months === 12 ? subYears(today, 1) : subMonths(today, months))
  const points = seriesForChart(exercise.type, sessions, metric, from)

  // Headline: latest value vs the latest value ~3 months ago.
  const headline = HEADLINE[exercise.type]
  const valued = sessions.flatMap((s) => {
    const v = sessionMetric(headline, s.sets)
    return v === null ? [] : [{ date: s.date, value: v }]
  })
  const current = valued.at(-1)
  const cutoff = dayKey(subDays(today, 90))
  const before = [...valued].reverse().find((v) => v.date <= cutoff)
  const delta = current && before ? current.value - before.value : null

  async function archive() {
    try {
      await deleteExercise(exercise.id)
      toast.success(`${exercise.name} archived`)
      await navigate({ to: '/exercises', replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not archive')
    }
  }

  return (
    <Screen>
      <TopBar title={exercise.name} back />
      <div className="-mt-4 flex flex-wrap items-center gap-2 text-muted-foreground">
        <span>
          {EQUIPMENT_LABELS[exercise.equipment]} · {MUSCLE_GROUP_LABELS[exercise.muscleGroup]} ·{' '}
          {EXERCISE_TYPE_LABELS[exercise.type]}
        </span>
        {!exercise.isPreset && (
          <Badge variant="secondary" className="bg-surface-3 text-muted-foreground">
            custom
          </Badge>
        )}
      </div>
      {exercise.defaultRestSeconds !== null && (
        <p className="tnum -mt-4 text-sm text-faint">
          Default rest {formatDuration(exercise.defaultRestSeconds)}
        </p>
      )}

      {sessions.length === 0 ? (
        <EmptyState
          icon={ChartLine}
          title="Charts, records and history will show up here once you log this exercise."
        />
      ) : (
        <>
          {current && (
            <section className="flex flex-col gap-1">
              <SectionLabel>{METRIC_LABELS[headline]}</SectionLabel>
              <p className="tnum font-display text-[40px] leading-none font-bold">
                {formatMetric(headline, current.value, unit)}
              </p>
              {delta !== null && (
                <p
                  className={cn(
                    'tnum text-sm',
                    delta > 0 ? 'text-success' : 'text-muted-foreground',
                  )}
                >
                  {delta >= 0 ? '▲' : '▼'} {formatMetric(headline, Math.abs(delta), unit)} vs 3
                  months ago
                </p>
              )}
            </section>
          )}

          <section
            className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4"
            aria-label="Progress chart"
          >
            {metrics.length > 1 && (
              <ToggleGroup
                type="single"
                value={metric}
                onValueChange={(v) => v && setMetric(v as ChartMetric)}
                className="grid w-full grid-cols-3"
                spacing={1}
                aria-label="Metric"
              >
                {metrics.map((m) => (
                  <ToggleGroupItem
                    key={m}
                    value={m}
                    className="h-9 bg-surface-2 text-sm data-[state=on]:bg-brand-dim data-[state=on]:text-brand"
                  >
                    {METRIC_LABELS[m]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
            {points.length > 0 ? (
              <ExerciseChart points={points} metric={metric} unit={unit} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No data in this range.
              </p>
            )}
            <ToggleGroup
              type="single"
              value={range}
              onValueChange={(v) => v && setRange(v as Range)}
              className="flex w-full justify-between"
              spacing={1}
              aria-label="Range"
            >
              {(Object.keys(RANGES) as Range[]).map((r) => (
                <ToggleGroupItem
                  key={r}
                  value={r}
                  className="h-9 flex-1 rounded-full text-sm text-muted-foreground data-[state=on]:bg-surface-3 data-[state=on]:text-foreground"
                >
                  {r}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </section>

          {history && history.records.length > 0 && (
            <section className="flex flex-col gap-2">
              <SectionLabel>Personal records</SectionLabel>
              <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
                {history.records.map((r) => (
                  <li
                    key={r.prType}
                    className="flex items-center gap-3 border-border px-4 py-3 not-last:border-b"
                  >
                    <Trophy className="size-5 shrink-0 text-pr" aria-hidden />
                    <span className="tnum flex-1 text-sm">
                      {formatPR({ ...r, previous: 0 }, unit)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {format(r.achievedAt, 'd MMM yyyy')}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <SectionLabel>History</SectionLabel>
            {[...sessions].reverse().map((s) => (
              <Link
                key={s.sessionId}
                to="/workout/$sessionId"
                params={{ sessionId: s.sessionId }}
                className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-4 hover:bg-surface-2"
              >
                <span className="text-sm font-medium text-muted-foreground">
                  {format(new Date(`${s.date}T00:00:00`), 'EEE d MMM yyyy')}
                </span>
                <ol className="tnum flex flex-col text-sm">
                  {s.sets
                    .filter((set) => set.completedAt !== null)
                    .map((set) => (
                      <li
                        key={set.id}
                        className={set.setType === 'warmup' ? 'text-faint' : undefined}
                      >
                        {set.setType === 'warmup' ? 'W ' : ''}
                        {formatSetLine(set, exercise.type, unit)}
                        {set.targetKind === 'failure' && (
                          <span className="ml-1 font-display font-bold text-failure">F</span>
                        )}
                      </li>
                    ))}
                </ol>
              </Link>
            ))}
          </section>
        </>
      )}

      {!exercise.isPreset && (
        <div className="flex flex-col gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil /> Edit exercise
          </Button>
          <Button variant="ghost" className="text-failure" onClick={() => setArchiving(true)}>
            <Archive /> Archive
          </Button>
        </div>
      )}

      <ExerciseFormSheet open={editing} onOpenChange={setEditing} exercise={exercise} />
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={`Archive ${exercise.name}?`}
        description="It disappears from the library and pickers. Workouts that used it keep their history."
        confirmLabel="Archive"
        onConfirm={archive}
      />
    </Screen>
  )
}
