import { createRootRoute, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { resolveSession, revalidateSession } from '@/features/auth/session'
import { SyncRuntime } from '@/features/sync/sync-runtime'

const PUBLIC_PATHS = new Set(['/login', '/signup'])

export const Route = createRootRoute({
  // Offline-first guard: a cached user (Dexie meta) is enough to enter the app.
  beforeLoad: async ({ location }) => {
    const user = await resolveSession()
    const isPublic = PUBLIC_PATHS.has(location.pathname)
    if (!user) {
      if (!isPublic) throw redirect({ to: '/login' })
      return { user: null }
    }
    if (isPublic) throw redirect({ to: user.needsOnboarding ? '/onboarding' : '/' })
    if (user.needsOnboarding && location.pathname !== '/onboarding') {
      throw redirect({ to: '/onboarding' })
    }
    return { user }
  },
  component: RootLayout,
})

function RootLayout() {
  const router = useRouter()
  const { user } = Route.useRouteContext()

  useEffect(() => {
    let cancelled = false
    async function revalidate() {
      if (!navigator.onLine) return
      const result = await revalidateSession()
      if (cancelled) return
      // Re-run the guard: routes to /login on 401, picks up profile changes otherwise.
      if (result === 'signed-out' || result === 'updated') await router.invalidate()
    }
    void revalidate()
    window.addEventListener('online', revalidate)
    return () => {
      cancelled = true
      window.removeEventListener('online', revalidate)
    }
  }, [router])

  return (
    <div className="min-h-dvh bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-foreground">
      {user ? (
        // Keyed by user so switching accounts restarts sync from a clean state.
        <SyncRuntime key={user.user.id}>
          <Outlet />
        </SyncRuntime>
      ) : (
        <Outlet />
      )}
      <Toaster position="top-center" />
    </div>
  )
}
