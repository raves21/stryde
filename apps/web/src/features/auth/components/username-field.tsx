import { normalizeUsername, USERNAME_REGEX } from '@stryde/shared'
import { Check, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { checkUsername } from '@/lib/api'

export type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

/** Username input with a debounced live availability check. */
export function UsernameField({
  value,
  onChange,
  onStatusChange,
}: {
  value: string
  onChange: (value: string) => void
  onStatusChange: (status: UsernameStatus) => void
}) {
  const [status, setStatus] = useState<UsernameStatus>('idle')

  useEffect(() => {
    const username = normalizeUsername(value)
    if (username === '') return update('idle')
    if (!USERNAME_REGEX.test(username)) return update('invalid')
    update('checking')
    const controller = new AbortController()
    const timer = setTimeout(() => {
      checkUsername(username, controller.signal)
        .then((r) => update(r.available ? 'available' : 'taken'))
        .catch(() => {
          if (!controller.signal.aborted) update('idle')
        })
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }

    function update(next: UsernameStatus) {
      setStatus(next)
      onStatusChange(next)
    }
  }, [value, onStatusChange])

  const hint =
    status === 'invalid'
      ? '3–20 characters: a–z, 0–9, _'
      : status === 'taken'
        ? 'That username is taken'
        : null

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="username">Username</Label>
      <div className="relative">
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={status === 'invalid' || status === 'taken'}
          aria-describedby={hint ? 'username-hint' : undefined}
          className="pr-10"
          required
        />
        <span className="-translate-y-1/2 absolute top-1/2 right-3" aria-live="polite">
          {status === 'checking' && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Checking" />
          )}
          {status === 'available' && (
            <Check className="size-4 text-success" aria-label="Available" />
          )}
          {(status === 'taken' || status === 'invalid') && (
            <X className="size-4 text-destructive" aria-label="Not available" />
          )}
        </span>
      </div>
      {hint && (
        <p id="username-hint" className="text-sm text-destructive">
          {hint}
        </p>
      )}
    </div>
  )
}
