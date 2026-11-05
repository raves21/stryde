import { Blobatar } from '@blobatar/react'
import { cn } from '@/lib/utils'

/**
 * Profile picture drawn from the username (blobatar.dev, the `@blobatar/react` package):
 * the same name always gives the same face, it is generated in the browser (no request,
 * works offline) and it is static, there is deliberately no `animate` prop. Size it with
 * Tailwind classes on `className` (default 40px).
 */
export function UserAvatar({
  username,
  displayName,
  className,
}: {
  username: string | null
  /** Seed for accounts that have no username yet (onboarding). */
  displayName?: string
  className?: string
}) {
  const seed = username || displayName || '?'
  return (
    <span className={cn('inline-flex size-10 shrink-0 rounded-full bg-surface-3', className)}>
      {/* Drawn at 2× the largest size we show it at, so it stays sharp on phones. */}
      <Blobatar name={seed} size={128} alt="" className="size-full rounded-full object-cover" />
    </span>
  )
}
