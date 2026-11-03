import type { Friend } from '@stryde/shared'
import { formatDistanceToNowStrict } from 'date-fns'
import { BellOff, Ellipsis, UserMinus } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { UserAvatar } from '@/components/app/user-avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFriendActions } from '../use-social'

/** Friend list row: avatar, name, @username, last workout, ⋯ menu (UI_DESIGN.md §5.12). */
export function FriendRow({ friend }: { friend: Friend }) {
  const actions = useFriendActions()
  const [confirmRemove, setConfirmRemove] = useState(false)
  return (
    <li className="flex min-h-16 items-center gap-3">
      <UserAvatar displayName={friend.displayName} avatarUrl={friend.avatarUrl} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{friend.displayName}</span>
        <span className="truncate text-sm text-muted-foreground">
          @{friend.username}
          {friend.lastWorkoutAt &&
            ` · trained ${formatDistanceToNowStrict(friend.lastWorkoutAt, { addSuffix: true })}`}
          {friend.muted && ' · muted'}
        </span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`${friend.displayName} options`}>
            <Ellipsis className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => actions.mute.mutate({ userId: friend.userId, muted: !friend.muted })}
          >
            <BellOff /> {friend.muted ? 'Unmute notifications' : 'Mute notifications'}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmRemove(true)}>
            <UserMinus /> Remove friend
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove ${friend.displayName}?`}
        description="You'll no longer see each other's workouts. You can add each other again later."
        confirmLabel="Remove"
        onConfirm={() => actions.remove.mutate(friend.userId)}
      />
    </li>
  )
}
