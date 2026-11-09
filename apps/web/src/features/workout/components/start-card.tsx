import { Link } from '@tanstack/react-router'
import { Activity, Play } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SportPicker } from '@/features/exercises/components/sport-picker'
import { useNow } from '@/lib/use-now'
import { formatElapsed } from '@/lib/workout'
import { useStartWorkout } from '../use-start-workout'
import { useActiveSession } from '../use-workout'

/** Today's start card: "Start empty workout", or "Resume Push Day · 32:14" (UI_DESIGN.md §5.3). */
export function StartCard() {
  const active = useActiveSession()
  const now = useNow(1000, !!active)
  const { startEmpty, startSport } = useStartWorkout()
  const [pickingSport, setPickingSport] = useState(false)
  if (active === undefined) return null
  if (active) {
    return (
      <Button size="lg" asChild>
        <Link to="/workout/active">
          <Play /> Resume {active.name} ·{' '}
          <span className="tnum">{formatElapsed(now - Date.parse(active.startedAt))}</span>
        </Link>
      </Button>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" onClick={() => void startEmpty()}>
        <Play /> Start empty workout
      </Button>
      <Button size="lg" variant="secondary" onClick={() => setPickingSport(true)}>
        <Activity /> Start a sport
      </Button>
      <SportPicker
        open={pickingSport}
        onOpenChange={setPickingSport}
        onPick={(sport) => void startSport(sport.id)}
      />
    </div>
  )
}
