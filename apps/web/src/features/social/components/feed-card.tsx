import type { FeedItem } from '@stryde/shared'
import { Link } from '@tanstack/react-router'
import { formatDistanceToNowStrict } from 'date-fns'
import { Timer } from 'lucide-react'
import { PRBadge } from '@/components/app/pr-badge'
import { UserAvatar } from '@/components/app/user-avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatSpan } from '@/features/progress/use-training'
import { useUnit } from '@/features/settings/use-settings'
import { formatPR } from '@/features/workout/format-pr'
import { ReactionBar } from './reaction-bar'

/** One finished workout in the feed (UI_DESIGN.md §5.11). */
export function FeedCard({ item }: { item: FeedItem }) {
  const unit = useUnit()
  const { actor } = item
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <Link
        to="/workout/$sessionId"
        params={{ sessionId: item.sessionId }}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center gap-3">
          <UserAvatar username={actor.username} displayName={actor.displayName} />
          <p className="min-w-0 flex-1 truncate font-semibold">
            {actor.isMe ? 'You' : actor.displayName}
          </p>
          <time dateTime={item.finishedAt} className="text-sm text-muted-foreground">
            {formatDistanceToNowStrict(item.finishedAt, { addSuffix: true })}
          </time>
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Finished
          </p>
          <h2 className="font-display text-2xl font-semibold uppercase leading-tight">
            {item.name}
          </h2>
          <p className="tnum flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Timer className="size-4" aria-hidden /> {formatSpan(item.durationSec * 1000)}
            </span>
            {item.sport ? (
              <>
                <span aria-hidden>·</span>
                <span>Sport</span>
              </>
            ) : (
              <>
                <span aria-hidden>·</span>
                <span>
                  {item.exerciseCount} {item.exerciseCount === 1 ? 'exercise' : 'exercises'}
                </span>
                <span aria-hidden>·</span>
                <span>
                  {item.setCount} {item.setCount === 1 ? 'set' : 'sets'}
                </span>
              </>
            )}
          </p>
        </div>
      </Link>
      {item.prs.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="self-start" aria-label="Show personal records">
              <PRBadge count={item.prs.length} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="flex w-72 flex-col gap-2">
            {item.prs.map((pr) => (
              <p key={`${pr.exerciseId}-${pr.prType}`} className="text-sm">
                <span className="font-semibold">{pr.exerciseName}</span>
                <span className="text-muted-foreground"> · </span>
                <span className="tnum text-pr">{formatPR({ ...pr, setId: null }, unit)}</span>
              </p>
            ))}
          </PopoverContent>
        </Popover>
      )}
      <div className="border-t border-border pt-3">
        <ReactionBar
          sessionId={item.sessionId}
          reactions={item.reactions}
          myReaction={item.myReaction}
        />
      </div>
    </article>
  )
}
