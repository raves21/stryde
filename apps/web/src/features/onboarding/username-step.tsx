import { normalizeUsername } from '@stryde/shared'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { UsernameField, type UsernameStatus } from '@/features/auth/components/username-field'
import { completeSignIn } from '@/features/auth/session'
import { authClient } from '@/lib/auth-client'

export function UsernameStep({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState('')
  const [status, setStatus] = useState<UsernameStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const { error } = await authClient.updateUser({ username: normalizeUsername(username) })
    if (error) {
      setPending(false)
      setError(error.message ?? 'Could not save username')
      return
    }
    await completeSignIn()
    onDone()
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[28px] font-semibold leading-tight">Pick a username</h1>
        <p className="text-muted-foreground">
          Friends find you by it. You can't sign in without one.
        </p>
      </div>
      <UsernameField value={username} onChange={setUsername} onStatusChange={setStatus} />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending || status !== 'available'}>
        Continue
      </Button>
    </form>
  )
}
