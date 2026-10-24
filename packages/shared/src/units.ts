import type { WeightUnit } from './constants'

// Weights are stored in kg. Convert only at the display/input boundary.

export const KG_PER_LB = 0.45359237

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB
}

/** Round to the nearest multiple of `step` (e.g. 0.5, 1.25). */
export function roundToStep(value: number, step: number): number {
  if (step <= 0) throw new RangeError('step must be > 0')
  const rounded = Math.round(value / step) * step
  // Trim floating-point noise such as 77.50000000000001.
  return Number(rounded.toFixed(6))
}

/** Round to `decimals` places (DB stores numeric(7,2)). */
export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/** kg (stored) → value in the user's unit, rounded for display. */
export function toDisplayWeight(kg: number, unit: WeightUnit, decimals = 1): number {
  return roundTo(unit === 'kg' ? kg : kgToLb(kg), decimals)
}

/** Value typed in the user's unit → kg to store (2 decimals, matching numeric(7,2)). */
export function fromInputWeight(value: number, unit: WeightUnit): number {
  return roundTo(unit === 'kg' ? value : lbToKg(value), 2)
}
