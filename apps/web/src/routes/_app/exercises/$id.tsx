import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Archive, ChartLine, Pencil, SearchX } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { EmptyState } from '@/components/app/empty-state'
import { Screen } from '@/components/app/screen'
import { TopBar } from '@/components/app/top-bar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { deleteExercise } from '@/db/repositories/exercises'
import { ExerciseFormSheet } from '@/features/exercises/components/exercise-form-sheet'
import {
  EQUIPMENT_LABELS,
  EXERCISE_TYPE_LABELS,
  formatDuration,
  MUSCLE_GROUP_LABELS,
} from '@/features/exercises/labels'
import { useExercise } from '@/features/exercises/use-exercises'

export const Route = createFileRoute('/_app/exercises/$id')({
  component: ExerciseDetail,
})

// Stub: charts, records and history arrive in Phase 5.
function ExerciseDetail() {
  const { id } = Route.useParams()
  const exercise = useExercise(id)
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)

  if (exercise === undefined) return null
  if (exercise === null) {
    return (
      <Screen>
        <TopBar title="Exercise" back />
        <EmptyState icon={SearchX} title="This exercise doesn't exist or was archived." />
      </Screen>
    )
  }

  async function archive() {
    try {
      await deleteExercise(id)
      toast.success(`${exercise?.name} archived`)
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
        <p className="tnum text-sm text-faint">
          Default rest {formatDuration(exercise.defaultRestSeconds)}
        </p>
      )}

      <EmptyState
        icon={ChartLine}
        title="Charts, records and history will show up here once you log this exercise."
      />

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
