import {
  REACTION_EMOJI_MAP,
  REACTION_EMOJIS,
  type ReactionCounts,
  type ReactionEmoji,
} from '@stryde/shared'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useReact } from '../use-social'
import { ReactionPicker } from './reaction-picker'
import { ReactorsSheet } from './reactors-sheet'

/**
 * Counts per emoji (tap → who reacted) plus a picker to react (UI_DESIGN.md §5.11).
 * Reacting is optimistic and rolls back on failure.
 */
export function ReactionBar({
  sessionId,
  reactions,
  myReaction,
}: {
  sessionId: string
  reactions: ReactionCounts
  myReaction: ReactionEmoji | null
}) {
  const [showReactors, setShowReactors] = useState(false)
  const react = useReact(sessionId)
  const present = REACTION_EMOJIS.filter((e) => (reactions[e] ?? 0) > 0)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {present.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => setShowReactors(true)}
          aria-label={`${reactions[emoji]} ${emoji} reactions, show who reacted`}
          className={cn(
            'tnum flex min-h-9 items-center gap-1 rounded-full border border-border bg-surface-2 px-3 text-sm font-semibold',
            myReaction === emoji && 'border-brand ring-1 ring-brand',
          )}
        >
          <span aria-hidden>{REACTION_EMOJI_MAP[emoji]}</span>
          {reactions[emoji]}
        </button>
      ))}
      <ReactionPicker
        selected={myReaction}
        onPick={(emoji) => react.mutate({ emoji, current: myReaction })}
      />
      <ReactorsSheet sessionId={sessionId} open={showReactors} onOpenChange={setShowReactors} />
    </div>
  )
}
