import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Screen } from '@/components/app/screen'
import { TopBar } from '@/components/app/top-bar'
import { Button } from '@/components/ui/button'
import { ExerciseBrowser } from '@/features/exercises/components/exercise-browser'
import { ExerciseFormSheet } from '@/features/exercises/components/exercise-form-sheet'
import { GYM_TYPES } from '@/features/exercises/labels'

export const Route = createFileRoute('/_app/exercises/')({
  component: ExerciseLibrary,
})

function ExerciseLibrary() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const open = (id: string) => navigate({ to: '/exercises/$id', params: { id } })

  return (
    <Screen>
      <TopBar
        title="Exercises"
        back
        actions={
          <Button
            variant="ghost"
            size="icon"
            aria-label="New exercise"
            onClick={() => setCreating(true)}
          >
            <Plus className="size-6" />
          </Button>
        }
      />
      <ExerciseBrowser
        types={GYM_TYPES}
        onSelect={(e) => open(e.id)}
        onCreate={() => setCreating(true)}
      />
      <ExerciseFormSheet
        types={GYM_TYPES}
        open={creating}
        onOpenChange={setCreating}
        onSaved={(e) => open(e.id)}
      />
    </Screen>
  )
}
