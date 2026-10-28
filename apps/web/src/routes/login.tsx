import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleButton } from '@/features/auth/components/google-button'
import { OfflineBanner } from '@/features/auth/components/offline-banner'
import { OrDivider } from '@/features/auth/components/or-divider'
import { UnsyncedDataNotice } from '@/features/auth/components/unsynced-data-notice'
import { Wordmark } from '@/features/auth/components/wordmark'
import { completeSignIn } from '@/features/auth/session'
import { authClient } from '@/lib/auth-client'
import { useOnline } from '@/lib/use-online'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const online = useOnline()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const id = identifier.trim()
    const { error } = id.includes('@')
      ? await authClient.signIn.email({ email: id, password })
      : await authClient.signIn.username({ username: id, password })
    if (error) {
      setPending(false)
      setError(
        error.status === 401
          ? 'Wrong email/username or password'
          : (error.message ?? 'Sign-in failed'),
      )
      return
    }
    try {
      const me = await completeSignIn()
      await navigate({ to: me.needsOnboarding ? '/onboarding' : '/' })
    } catch (err) {
      setPending(false)
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-12">
      <Wordmark />
      {!online && <OfflineBanner message="You're offline, so signing in needs a connection." />}
      <UnsyncedDataNotice />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="identifier">Email or username</Label>
          <Input
            id="identifier"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={!online || pending}>
          Sign in
        </Button>
      </form>
      <OrDivider />
      <GoogleButton disabled={!online} />
      <div className="flex flex-col gap-3 text-center text-sm">
        <p className="text-muted-foreground">
          New here?{' '}
          <Link
            to="/signup"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
        <p className="text-faint">Forgot password? Sign in with Google or contact the admin.</p>
      </div>
    </main>
  )
}
