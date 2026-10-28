import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { startEmptySession, startSessionFromTemplate } from '@/db/repositories/sessions'

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
  }
}
