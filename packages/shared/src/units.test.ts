import { describe, expect, it } from 'vitest'
import { fromInputWeight, kgToLb, lbToKg, roundTo, roundToStep, toDisplayWeight } from './units'

describe('kgToLb / lbToKg', () => {
  it.each([
    [0, 0],
    [1, 2.20462],
    [20, 44.0925],
    [100, 220.462],
  ])('%d kg ≈ %d lb', (kg, lb) => {
    expect(kgToLb(kg)).toBeCloseTo(lb, 3)
    expect(lbToKg(lb)).toBeCloseTo(kg, 3)
  })

  it('round-trips', () => {
    expect(lbToKg(kgToLb(82.5))).toBeCloseTo(82.5, 10)
  })
})

describe('roundToStep', () => {
  it.each([
    [77.3, 0.5, 77.5],
    [77.2, 0.5, 77],
    [101.3, 1.25, 101.25],
    [44.0925, 2.5, 45],
    [0.1 + 0.2, 0.1, 0.3],
  ])('roundToStep(%d, %d) = %d', (value, step, expected) => {
    expect(roundToStep(value, step)).toBe(expected)
  })

  it('rejects non-positive steps', () => {
    expect(() => roundToStep(10, 0)).toThrow(RangeError)
  })
})

describe('roundTo', () => {
  it.each([
    [1.005, 2, 1.01],
    [80, 2, 80],
    [36.287, 1, 36.3],
  ])('roundTo(%d, %d) = %d', (value, decimals, expected) => {
    expect(roundTo(value, decimals)).toBe(expected)
  })
})

describe('display/input boundary', () => {
  it.each([
    [80, 'kg', 80],
    [80, 'lb', 176.4],
    [36.29, 'lb', 80],
  ] as const)('toDisplayWeight(%d, %s) = %d', (kg, unit, expected) => {
    expect(toDisplayWeight(kg, unit)).toBe(expected)
  })

  it.each([
    [80, 'kg', 80],
    [135, 'lb', 61.23],
    [225, 'lb', 102.06],
  ] as const)('fromInputWeight(%d, %s) = %d', (value, unit, expected) => {
    expect(fromInputWeight(value, unit)).toBe(expected)
  })
})
