import type { ExerciseRow } from '@stryde/shared'
import { useState } from 'react'
import { BottomSheet } from '@/components/app/bottom-sheet'
import { ExerciseBrowser } from './exercise-browser'
import { ExerciseFormSheet } from './exercise-form-sheet'

const SPORT_ONLY = ['sport'] as const

/** Pick a sport (presets and the user's own) to start; "Create custom sport" adds one. */
export function SportPicker({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (sport: ExerciseRow) => void
}) {
  const [creating, setCreating] = useState(false)
  function pick(sport: ExerciseRow) {
    onPick(sport)
    onOpenChange(false)
  }
  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Start a sport"
        className="h-[80dvh] max-h-[80dvh]"
      >
        <ExerciseBrowser
          onSelect={pick}
          types={SPORT_ONLY}
          muscleChips={false}
          stickyTop="top-0"
          onCreate={() => setCreating(true)}
          createLabel="Create custom sport"
        />
      </BottomSheet>
      <ExerciseFormSheet
        open={creating}
        onOpenChange={setCreating}
        onSaved={pick}
        types={SPORT_ONLY}
      />
    </>
  )
}
