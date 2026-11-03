import { REACTION_EMOJI_MAP } from '@stryde/shared'
import { BottomSheet } from '@/components/app/bottom-sheet'
import { UserAvatar } from '@/components/app/user-avatar'
import { useReactors } from '../use-social'

/** Who reacted to a session. */
export function ReactorsSheet({
  sessionId,
  open,
  onOpenChange,
}: {
  sessionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data, isPending, isError } = useReactors(sessionId, open)
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Reactions">
      {isPending && <p className="py-6 text-center text-muted-foreground">Loading…</p>}
      {isError && (
        <p className="py-6 text-center text-muted-foreground">Couldn't load reactions.</p>
      )}
      {data?.length === 0 && (
        <p className="py-6 text-center text-muted-foreground">No reactions yet.</p>
      )}
      <ul className="flex flex-col">
        {data?.map((r) => (
          <li key={r.userId} className="flex min-h-14 items-center gap-3">
            <UserAvatar displayName={r.displayName} avatarUrl={r.avatarUrl} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{r.displayName}</span>
              <span className="truncate text-sm text-muted-foreground">@{r.username}</span>
            </div>
            <span className="text-2xl" role="img" aria-label={r.emoji}>
              {REACTION_EMOJI_MAP[r.emoji]}
            </span>
          </li>
        ))}
      </ul>
    </BottomSheet>
  )
}
