import { describe, expect, it } from 'vitest'
import { isValidUsername, normalizeUsername } from './auth'

describe('isValidUsername', () => {
  it.each([
    ['juandc', true],
    ['juan_dc_99', true],
    ['abc', true],
    ['a'.repeat(20), true],
    ['ab', false],
    ['a'.repeat(21), false],
    ['Juan', false],
    ['juan.dc', false],
    ['juan-dc', false],
    ['juan dc', false],
    ['', false],
  ])('%s → %s', (input, expected) => {
    expect(isValidUsername(input)).toBe(expected)
  })
})

describe('normalizeUsername', () => {
  it.each([
    ['  JuanDC ', 'juandc'],
    ['bea_s', 'bea_s'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeUsername(input)).toBe(expected)
  })
})
