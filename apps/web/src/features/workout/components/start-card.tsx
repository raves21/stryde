import { Link } from '@tanstack/react-router'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNow } from '@/lib/use-now'
import { formatElapsed } from '@/lib/workout'
import { useStartWorkout } from '../use-start-workout'
import { useActiveSession } from '../use-workout'

/** Today's start card: "Start empty workout", or "Resume Push Day · 32:14" (UI_DESIGN.md §5.3). */
export function StartCard() {
  const active = useActiveSession()
  const now = useNow(1000, !!active)
  const { startEmpty } = useStartWorkout()
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
    <Button size="lg" onClick={() => void startEmpty()}>
      <Play /> Start empty workout
    </Button>
  )
}
