import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { SessionTree } from '@/db/repositories/sessions'
import { addExerciseToSession } from '@/db/repositories/sessions'
import { ExercisePicker } from '@/features/exercises/components/exercise-picker'
import { useUnit } from '@/features/settings/use-settings'
import type { WorkoutActions } from '../use-workout-actions'
import { WorkoutExerciseCard } from './workout-exercise-card'

/** "A1", "A2"… by order within each superset group. */
function supersetLabels(tree: SessionTree): Map<string, string> {
  const seen = new Map<string, number>()
  const labels = new Map<string, string>()
  for (const { row } of tree.exercises) {
    if (!row.supersetGroup) continue
    const n = (seen.get(row.supersetGroup) ?? 0) + 1
    seen.set(row.supersetGroup, n)
    labels.set(row.id, `${row.supersetGroup}${n}`)
  }
  return labels
}

/** Exercise cards + "Add exercise", shared by the active workout and edit screens. */
export function WorkoutBody({ tree, actions }: { tree: SessionTree; actions: WorkoutActions }) {
  const unit = useUnit()
  const [picking, setPicking] = useState(false)
  const labels = useMemo(() => supersetLabels(tree), [tree])

  return (
    <>
      <div className="flex flex-col gap-3">
        {tree.exercises.map((item, index) => (
          <WorkoutExerciseCard
            key={item.row.id}
            item={item}
            supersetLabel={labels.get(item.row.id) ?? null}
            unit={unit}
            isFirst={index === 0}
            isLast={index === tree.exercises.length - 1}
            actions={actions}
          />
        ))}
      </div>
      <Button variant="secondary" size="lg" onClick={() => setPicking(true)}>
        <Plus /> Add exercise
      </Button>
      <ExercisePicker
        open={picking}
        onOpenChange={setPicking}
        onPick={(e) => void addExerciseToSession(tree.session.id, e.id)}
      />
    </>
  )
}
