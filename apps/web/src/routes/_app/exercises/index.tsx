import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Screen } from '@/components/app/screen'
import { TopBar } from '@/components/app/top-bar'
import { Button } from '@/components/ui/button'
import { ExerciseBrowser } from '@/features/exercises/components/exercise-browser'
import { ExerciseFormSheet } from '@/features/exercises/components/exercise-form-sheet'

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
      <ExerciseBrowser onSelect={(e) => open(e.id)} />
      <ExerciseFormSheet open={creating} onOpenChange={setCreating} onSaved={(e) => open(e.id)} />
    </Screen>
  )
}
