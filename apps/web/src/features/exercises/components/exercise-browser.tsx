import { type ExerciseRow, MUSCLE_GROUPS, type MuscleGroup } from '@stryde/shared'
import { ChevronRight, Search, SearchX } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { EmptyState } from '@/components/app/empty-state'
import { SectionLabel } from '@/components/app/section-label'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from '../labels'
import { useExercises, useRecentExerciseIds } from '../use-exercises'

/**
 * Search + muscle chips + list (UI_DESIGN.md §5.9). Used by the library page and the
 * exercise picker sheet.
 */
export function ExerciseBrowser({
  onSelect,
  showRecent = false,
  footer,
  stickyTop = 'top-14',
}: {
  onSelect: (exercise: ExerciseRow) => void
  showRecent?: boolean
  footer?: ReactNode
  /** Offset of the sticky search bar (below the page's top bar). */
  stickyTop?: string
}) {
  const exercises = useExercises()
  const recentIds = useRecentExerciseIds()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (exercises ?? []).filter(
      (e) =>
        (muscle === 'all' || e.muscleGroup === muscle) &&
        (q === '' || e.name.toLowerCase().includes(q)),
    )
  }, [exercises, query, muscle])

  const recent = useMemo(() => {
    if (!showRecent || query || muscle !== 'all' || !exercises) return []
    const byId = new Map(exercises.map((e) => [e.id, e]))
    return recentIds.flatMap((id) => byId.get(id) ?? [])
  }, [showRecent, query, muscle, exercises, recentIds])

  return (
    <div className="flex flex-col gap-4">
      <div className={`sticky ${stickyTop} z-10 -mx-4 flex flex-col gap-3 bg-background px-4 pb-2`}>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search exercises"
            aria-label="Search exercises"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <ToggleGroup
          type="single"
          value={muscle}
          onValueChange={(v) => setMuscle((v || 'all') as MuscleGroup | 'all')}
          className="-mx-4 w-auto justify-start overflow-x-auto px-4 [scrollbar-width:none]"
          spacing={2}
          aria-label="Filter by muscle group"
        >
          {(['all', ...MUSCLE_GROUPS] as const).map((m) => (
            <ToggleGroupItem
              key={m}
              value={m}
              className="h-9 shrink-0 rounded-full bg-surface-3 px-4 text-muted-foreground data-[state=on]:bg-brand data-[state=on]:text-primary-foreground"
            >
              {m === 'all' ? 'All' : MUSCLE_GROUP_LABELS[m]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {recent.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Recent</SectionLabel>
          <ExerciseList exercises={recent} onSelect={onSelect} />
        </section>
      )}

      {exercises && filtered.length === 0 ? (
        <EmptyState icon={SearchX} title="No exercises match. Try another name or muscle group." />
      ) : (
        <section className="flex flex-col gap-2">
          {recent.length > 0 && <SectionLabel>All exercises</SectionLabel>}
          <ExerciseList exercises={filtered} onSelect={onSelect} />
        </section>
      )}
      {footer}
    </div>
  )
}

function ExerciseList({
  exercises,
  onSelect,
}: {
  exercises: ExerciseRow[]
  onSelect: (exercise: ExerciseRow) => void
}) {
  return (
    <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
      {exercises.map((e) => (
        <li key={e.id} className="border-border not-last:border-b">
          <button
            type="button"
            onClick={() => onSelect(e)}
            className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2 active:bg-surface-3"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium">{e.name}</span>
                {!e.isPreset && (
                  <Badge
                    variant="secondary"
                    className="shrink-0 bg-surface-3 text-muted-foreground"
                  >
                    custom
                  </Badge>
                )}
              </span>
              <span className="text-sm text-muted-foreground">
                {EQUIPMENT_LABELS[e.equipment]} · {MUSCLE_GROUP_LABELS[e.muscleGroup]}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-faint" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}
