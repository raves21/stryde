import type { ExerciseRow } from '@stryde/shared'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { BottomSheet } from '@/components/app/bottom-sheet'
import { Button } from '@/components/ui/button'
import { ExerciseBrowser } from './exercise-browser'
import { ExerciseFormSheet } from './exercise-form-sheet'

/**
 * Pick an exercise: search, recent, muscle chips, "create custom" (UI_DESIGN.md §5.4).
 * Used by the template editor and (Phase 4) the active workout.
 */
export function ExercisePicker({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (exercise: ExerciseRow) => void
}) {
  const [creating, setCreating] = useState(false)

  function pick(exercise: ExerciseRow) {
    onPick(exercise)
    onOpenChange(false)
  }

  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Add exercise"
        className="h-[90dvh] max-h-[90dvh]"
      >
        <ExerciseBrowser
          onSelect={pick}
          showRecent
          stickyTop="top-0"
          footer={
            <Button variant="secondary" onClick={() => setCreating(true)}>
              <Plus /> Create custom exercise
            </Button>
          }
        />
      </BottomSheet>
      <ExerciseFormSheet open={creating} onOpenChange={setCreating} onSaved={pick} />
    </>
  )
}
