import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { signOut } from '@/features/auth/session'
import { useOnline } from '@/lib/use-online'

export const Route = createFileRoute('/')({
  component: Home,
})

// Placeholder until the Today screen (Phase 3).
function Home() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const online = useOnline()
  const [pending, setPending] = useState(false)

  async function onSignOut() {
    setPending(true)
    await signOut()
    await router.invalidate()
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 pt-16">
      <h1 className="font-display text-[40px] font-bold uppercase leading-none tracking-tight">
        Stryde
      </h1>
      <p className="text-muted-foreground">
        Signed in as {user?.user.displayName}
        {user?.user.username && <span className="text-faint"> @{user.user.username}</span>}
      </p>
      <Button size="lg">Start workout</Button>
      {/* Sign-out needs the server to clear the httpOnly cookie. */}
      <Button variant="ghost" onClick={onSignOut} disabled={!online || pending}>
        {online ? 'Sign out' : 'Sign out (needs a connection)'}
      </Button>
    </main>
  )
}
