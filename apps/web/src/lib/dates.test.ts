import { describe, expect, it } from 'vitest'
import { weekdayInitials } from './dates'

describe('weekdayInitials', () => {
  it('starts on Sunday', () => {
    expect(
      weekdayInitials()
        .map((d) => d.letter)
        .join(''),
    ).toBe('SMTWTFS')
    expect(weekdayInitials().map((d) => d.day)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
})
