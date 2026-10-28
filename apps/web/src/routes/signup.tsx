import { normalizeUsername, PASSWORD_MIN_LENGTH } from '@stryde/shared'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleButton } from '@/features/auth/components/google-button'
import { OfflineBanner } from '@/features/auth/components/offline-banner'
import { OrDivider } from '@/features/auth/components/or-divider'
import { UnsyncedDataNotice } from '@/features/auth/components/unsynced-data-notice'
import { UsernameField, type UsernameStatus } from '@/features/auth/components/username-field'
import { Wordmark } from '@/features/auth/components/wordmark'
import { completeSignIn } from '@/features/auth/session'
import { authClient } from '@/lib/auth-client'
import { useOnline } from '@/lib/use-online'

export const Route = createFileRoute('/signup')({
  component: SignupPage,
})

function SignupPage() {
  const navigate = useNavigate()
  const online = useOnline()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const { error } = await authClient.signUp.email({
      name: name.trim(),
      username: normalizeUsername(username),
      email: email.trim(),
      password,
    })
    if (error) {
      setPending(false)
      setError(error.message ?? 'Sign-up failed')
      return
    }
    try {
      await completeSignIn()
      await navigate({ to: '/onboarding' })
    } catch (err) {
      setPending(false)
      setError(err instanceof Error ? err.message : 'Sign-up failed')
    }
  }

  const blocked = usernameStatus === 'taken' || usernameStatus === 'invalid'

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-12">
      <Wordmark />
      {!online && <OfflineBanner message="You're offline, so signing up needs a connection." />}
      <UnsyncedDataNotice />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Display name</Label>
          <Input
            id="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <UsernameField value={username} onChange={setUsername} onStatusChange={setUsernameStatus} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="text-sm text-faint">At least {PASSWORD_MIN_LENGTH} characters.</p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={!online || pending || blocked}>
          Create account
        </Button>
      </form>
      <OrDivider />
      <GoogleButton disabled={!online} />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </main>
  )
}
