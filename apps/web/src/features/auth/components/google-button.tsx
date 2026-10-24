import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'

export function GoogleButton({ disabled }: { disabled?: boolean }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function signIn() {
    setError(null)
    setPending(true)
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/',
      errorCallbackURL: '/login',
    })
    if (error) {
      setPending(false)
      setError(
        error.code === 'PROVIDER_NOT_FOUND'
          ? "Google sign-in isn't set up on this server"
          : (error.message ?? 'Google sign-in is unavailable'),
      )
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={signIn}
        disabled={disabled || pending}
      >
        <GoogleLogo />
        Continue with Google
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

// Monochrome G mark (UI_DESIGN.md §5.1: white G on --surface-2).
function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="currentColor">
      <path d="M21.35 11.1H12v3.2h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.95S8.78 6.5 12 6.5c1.83 0 3.06.78 3.76 1.45l2.57-2.48C16.68 3.94 14.55 3 12 3 7.03 3 3 7.03 3 12s4.03 9 9 9c5.2 0 8.64-3.65 8.64-8.8 0-.6-.07-1.05-.29-1.1Z" />
    </svg>
  )
}
