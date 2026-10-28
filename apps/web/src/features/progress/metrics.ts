import {
  type ChartMetric,
  type ExerciseType,
  toDisplayWeight,
  type WeightUnit,
} from '@stryde/shared'
import { formatDuration } from '@/lib/workout'

export const METRIC_LABELS: Record<ChartMetric, string> = {
  e1rm: 'e1RM',
  best_set: 'Best set',
  volume: 'Volume',
  max_reps: 'Max reps',
  total_reps: 'Total reps',
  duration: 'Duration',
}

/** The headline metric per exercise type (UI_DESIGN.md §5.9). */
export const HEADLINE: Record<ExerciseType, ChartMetric> = {
  weighted: 'e1rm',
  bodyweight: 'max_reps',
  timed: 'duration',
}

const isWeight = (m: ChartMetric) => m === 'e1rm' || m === 'best_set' || m === 'volume'

/** Value in display units (kg/lb for weights). */
export function displayValue(metric: ChartMetric, value: number, unit: WeightUnit): number {
  return isWeight(metric) ? toDisplayWeight(value, unit, metric === 'volume' ? 0 : 1) : value
}

export function formatMetric(metric: ChartMetric, value: number, unit: WeightUnit): string {
  if (metric === 'duration') return formatDuration(Math.round(value))
  if (isWeight(metric)) return `${displayValue(metric, value, unit).toLocaleString()} ${unit}`
  return `${value} reps`
}
