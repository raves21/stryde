import { describe, expect, it } from 'vitest'
import { transitionType } from './view-transition'

describe('transitionType', () => {
  it.each([
    ['tab → tab', '/', '/feed', 'fade'],
    ['tab → tab (progress)', '/progress', '/profile', 'fade'],
    ['tab → sub-screen', '/', '/history', 'forward'],
    ['tab → deep screen', '/profile', '/settings/sync', 'forward'],
    ['sub-screen → tab', '/history', '/', 'back'],
    ['deep → tab', '/settings/sync', '/profile', 'back'],
    ['list → detail', '/templates', '/templates/abc', 'forward'],
    ['detail → list', '/templates/abc', '/templates', 'back'],
    ['sibling screens', '/templates', '/exercises', 'fade'],
    ['trailing slash is the same path', '/templates/', '/templates', false],
    ['same path (search params only)', '/feed', '/feed', false],
  ] as const)('%s', (_, from, to, expected) => {
    expect(transitionType(from, to)).toBe(expected)
  })
})
