import type { FriendRequest } from '@stryde/shared'
import { UserAvatar } from '@/components/app/user-avatar'
import { Button } from '@/components/ui/button'
import { useFriendActions } from '../use-social'

/** A friend request: Accept / Decline when incoming, Cancel when I sent it. */
export function RequestRow({
  request,
  direction,
}: {
  request: FriendRequest
  direction: 'incoming' | 'outgoing'
}) {
  const actions = useFriendActions()
  const { user } = request
  return (
    <li className="flex min-h-16 items-center gap-3">
      <UserAvatar username={user.username} displayName={user.displayName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{user.displayName}</span>
        <span className="truncate text-sm text-muted-foreground">@{user.username}</span>
      </div>
      {direction === 'incoming' ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => actions.answer.mutate({ id: request.id, action: 'decline' })}
            aria-label={`Decline ${user.displayName}`}
          >
            Decline
          </Button>
          <Button
            size="sm"
            onClick={() => actions.answer.mutate({ id: request.id, action: 'accept' })}
            aria-label={`Accept ${user.displayName}`}
          >
            Accept
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => actions.remove.mutate(user.userId)}
          aria-label={`Cancel request to ${user.displayName}`}
        >
          Cancel
        </Button>
      )}
    </li>
  )
}
