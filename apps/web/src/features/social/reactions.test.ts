import { describe, expect, it } from 'vitest'
import { type ReactionState, toggleReaction } from './reactions'

const none: ReactionState = { reactions: {}, myReaction: null }

describe('toggleReaction', () => {
  it.each([
    ['adds a first reaction', none, 'fire', { reactions: { fire: 1 }, myReaction: 'fire' }],
    [
      'adds next to others',
      { reactions: { fire: 2 }, myReaction: null },
      'fire',
      { reactions: { fire: 3 }, myReaction: 'fire' },
    ],
    [
      'tapping the same emoji removes mine and drops a zero count',
      { reactions: { fire: 1 }, myReaction: 'fire' },
      'fire',
      { reactions: {}, myReaction: null },
    ],
    [
      'tapping the same emoji keeps other people’s count',
      { reactions: { fire: 3 }, myReaction: 'fire' },
      'fire',
      { reactions: { fire: 2 }, myReaction: null },
    ],
    [
      'another emoji replaces mine',
      { reactions: { fire: 1, muscle: 1 }, myReaction: 'fire' },
      'trophy',
      { reactions: { muscle: 1, trophy: 1 }, myReaction: 'trophy' },
    ],
  ] as const)('%s', (_, state, emoji, expected) => {
    expect(toggleReaction(state as ReactionState, emoji)).toEqual(expected)
  })

  it('does not mutate its input', () => {
    const state: ReactionState = { reactions: { fire: 1 }, myReaction: 'fire' }
    toggleReaction(state, 'clap')
    expect(state).toEqual({ reactions: { fire: 1 }, myReaction: 'fire' })
  })
})
