import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { SignOutButton } from '@/features/auth/components/sign-out-button'
import { DevPanel } from '@/features/dev/components/dev-panel'
import { SyncIndicator } from '@/features/sync/components/sync-indicator'

export const Route = createFileRoute('/')({
  component: Home,
})

// Placeholder until the Today screen (Phase 3).
function Home() {
  const { user } = Route.useRouteContext()

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 pt-4">
      <header className="flex h-12 items-center justify-between">
        <h1 className="font-display text-[28px] font-semibold leading-none">Today</h1>
        <SyncIndicator />
      </header>
      <p className="text-muted-foreground">
        Signed in as {user?.user.displayName}
        {user?.user.username && <span className="text-faint"> @{user.user.username}</span>}
      </p>
      <Button size="lg">Start workout</Button>
      {import.meta.env.DEV && <DevPanel />}
      <SignOutButton />
    </main>
  )
}
