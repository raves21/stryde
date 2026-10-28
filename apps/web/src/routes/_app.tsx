import { createFileRoute, Outlet } from '@tanstack/react-router'
import { TabBar } from '@/features/shell/components/tab-bar'

// Signed-in screens with the bottom tab bar. Onboarding and (Phase 4) the active
// workout live outside it.
export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
  return (
    <>
      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </div>
      <TabBar />
    </>
  )
}
