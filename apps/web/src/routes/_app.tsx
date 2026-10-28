import { createFileRoute, Outlet } from '@tanstack/react-router'
import { TabBar } from '@/features/shell/components/tab-bar'
import { ActiveWorkoutMiniBar } from '@/features/workout/components/active-workout-mini-bar'
import { useActiveSession } from '@/features/workout/use-workout'
import { cn } from '@/lib/utils'

// Signed-in screens with the bottom tab bar. Onboarding and the active workout live
// outside it.
export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
  const active = useActiveSession()
  return (
    <>
      <div
        className={cn(
          active
            ? 'pb-[calc(7rem+env(safe-area-inset-bottom))]'
            : 'pb-[calc(4rem+env(safe-area-inset-bottom))]',
        )}
      >
        <Outlet />
      </div>
      <ActiveWorkoutMiniBar />
      <TabBar />
    </>
  )
}
