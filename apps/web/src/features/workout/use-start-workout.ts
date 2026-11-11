import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  getSessionTree,
  startEmptySession,
  startSessionFromTemplate,
  startSportSession,
} from '@/db/repositories/sessions'
import { startGameClock } from './sport-timer'

/** Start a workout and open it. */
export function useStartWorkout() {
  const navigate = useNavigate()
  async function go(start: () => Promise<unknown>) {
    try {
      await start()
      await navigate({ to: '/workout/active' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start the workout')
    }
  }
  return {
    startEmpty: () => go(() => startEmptySession()),
    startTemplate: (templateId: string) => go(() => startSessionFromTemplate(templateId)),
    // The first game's clock starts right away, from 0:00.
    startSport: (exerciseId: string) =>
      go(async () => {
        const session = await startSportSession(exerciseId)
        const game = (await getSessionTree(session.id))?.exercises[0]?.sets[0]
        if (game) await startGameClock(session.id, game.id)
      }),
  }
}
