import type { ReactionCounts, ReactionEmoji } from '@stryde/shared'

export type ReactionState = { reactions: ReactionCounts; myReaction: ReactionEmoji | null }

/**
 * The state after I tap `emoji`: the same one removes my reaction, another replaces it
 * (PRODUCT_SPEC.md §4.6). Used for the optimistic update; the server stays the truth.
 */
export function toggleReaction(state: ReactionState, emoji: ReactionEmoji): ReactionState {
  const counts = { ...state.reactions }
  const drop = (e: ReactionEmoji) => {
    const n = (counts[e] ?? 0) - 1
    if (n > 0) counts[e] = n
    else delete counts[e]
  }
  if (state.myReaction) drop(state.myReaction)
  if (state.myReaction === emoji) return { reactions: counts, myReaction: null }
  counts[emoji] = (counts[emoji] ?? 0) + 1
  return { reactions: counts, myReaction: emoji }
}
