import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

/** Image, or initials on `--surface-3` (UI_DESIGN.md §6.2 `Avatar`). */
export function UserAvatar({
  displayName,
  avatarUrl,
  className,
}: {
  displayName: string
  avatarUrl: string | null
  className?: string
}) {
  return (
    <Avatar className={cn('size-10', className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
      <AvatarFallback className="bg-surface-3 text-sm font-semibold">
        {initialsOf(displayName) || '?'}
      </AvatarFallback>
    </Avatar>
  )
}
