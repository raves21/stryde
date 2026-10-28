import { type DetectedPR, toDisplayWeight, type WeightUnit } from '@stryde/shared'
import { formatDuration } from '@/lib/workout'

const LABELS: Record<DetectedPR['prType'], string> = {
  e1rm: 'e1RM',
  weight: 'Heaviest',
  reps_at_weight: 'Most reps',
  volume: 'Volume',
  max_reps: 'Max reps',
  duration: 'Longest',
}

/** "e1RM 101.3 kg (+2.5)", "Most reps 9 @ 80 kg (+1)", "Longest 1:30 (+0:15)". */
export function formatPR(pr: DetectedPR, unit: WeightUnit): string {
  const kg = (v: number, decimals = 1) => `${toDisplayWeight(v, unit, decimals)} ${unit}`
  const gain = (text: string) => (pr.previous > 0 ? ` (+${text})` : '')
  switch (pr.prType) {
    case 'e1rm':
    case 'weight':
      return `${LABELS[pr.prType]} ${kg(pr.value)}${gain(String(toDisplayWeight(pr.value - pr.previous, unit)))}`
    case 'volume':
      return `${LABELS.volume} ${kg(pr.value, 0)}${gain(String(toDisplayWeight(pr.value - pr.previous, unit, 0)))}`
    case 'reps_at_weight':
      return `${LABELS.reps_at_weight} ${pr.value} @ ${kg(pr.weightKg ?? 0)}${gain(String(pr.value - pr.previous))}`
    case 'max_reps':
      return `${LABELS.max_reps} ${pr.value}${gain(String(pr.value - pr.previous))}`
    case 'duration':
      return `${LABELS.duration} ${formatDuration(pr.value)}${gain(formatDuration(pr.value - pr.previous))}`
  }
}
