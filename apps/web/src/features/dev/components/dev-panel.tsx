import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createExercise } from '@/db/repositories/exercises'
import { addSessionExercise, finishSession, startSession } from '@/db/repositories/sessions'
import { addSet } from '@/db/repositories/sets'
import { useLocalCounts } from '../use-local-counts'

// Temporary (Phase 2 acceptance): create rows offline, then watch them reach another
// browser profile. Rendered only in dev builds.

async function createTestWorkout() {
  const now = new Date().toISOString()
  const exercise = await createExercise({
    name: `Dev exercise ${now.slice(11, 19)}`,
    type: 'weighted',
    muscleGroup: 'chest',
    equipment: 'barbell',
  })
  const session = await startSession({ name: 'Dev workout' })
  const se = await addSessionExercise({
    sessionId: session.id,
    exerciseId: exercise.id,
    position: 0,
  })
  await addSet({
    sessionExerciseId: se.id,
    position: 0,
    setType: 'working',
    targetKind: 'fixed',
    targetReps: 8,
    targetRepsMax: null,
    targetRir: null,
    weightKg: 80,
    reps: 8,
    rir: null,
    durationSec: null,
    completedAt: now,
  })
  await finishSession(session.id)
}

export function DevPanel() {
  const counts = useLocalCounts()
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-surface p-4">
      <h2 className="text-sm font-medium text-muted-foreground">Dev: sync test</h2>
      <p className="tnum text-sm text-faint">
        Local: {counts?.exercises ?? 0} custom exercises · {counts?.sessions ?? 0} sessions ·{' '}
        {counts?.sets ?? 0} sets
      </p>
      <Button
        variant="secondary"
        onClick={() =>
          createTestWorkout().catch((e: unknown) =>
            toast.error(e instanceof Error ? e.message : 'Failed'),
          )
        }
      >
        Create test workout
      </Button>
    </section>
  )
}
