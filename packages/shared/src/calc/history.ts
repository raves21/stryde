import type { ExerciseType, PrType } from '../constants'
import { type DetectedPR, detectPRs } from './prs'
import {
  bestSet,
  type CalcSet,
  e1rm,
  longestDuration,
  maxReps,
  sessionVolume,
  totalReps,
} from './sets'

/** One session's sets of one exercise. */
export type CalcSession = {
  sessionId: string
  /** Calendar day (`localDate`). */
  date: string
  /** When the PR counts as achieved (the session's finishedAt). */
  at: string
  sets: CalcSet[]
}

export type PrEvent = DetectedPR & { sessionId: string; achievedAt: string }

/**
 * Every PR of one exercise, session by session (chronological input). Each event beat
 * everything before it; the first session with counted sets is the baseline.
 */
export function prTimeline(type: ExerciseType, sessions: CalcSession[]): PrEvent[] {
  const events: PrEvent[] = []
  const history: CalcSet[][] = []
  for (const s of sessions) {
    for (const pr of detectPRs(type, history, s.sets)) {
      events.push({ ...pr, sessionId: s.sessionId, achievedAt: s.at })
    }
    history.push(s.sets)
  }
  return events
}

/**
 * Current records of one exercise (the latest event per PR type), rebuilt from the whole
 * history so editing or deleting past sessions can lower them (PRODUCT_SPEC.md §6).
 */
export function computeAllPRs(type: ExerciseType, sessions: CalcSession[]): PrEvent[] {
  const latest = new Map<PrType, PrEvent>()
  for (const e of prTimeline(type, sessions)) latest.set(e.prType, e)
  return [...latest.values()]
}

export const CHART_METRICS = {
  weighted: ['e1rm', 'best_set', 'volume'],
  bodyweight: ['max_reps', 'total_reps', 'e1rm'],
  timed: ['duration'],
} as const satisfies Record<ExerciseType, readonly string[]>
export type ChartMetric = (typeof CHART_METRICS)[ExerciseType][number]

/** Which PR type marks a chart point as a PR. */
const METRIC_PR: Record<ChartMetric, PrType | null> = {
  e1rm: 'e1rm',
  best_set: 'weight',
  volume: 'volume',
  max_reps: 'max_reps',
  total_reps: null,
  duration: 'duration',
}

/** A session's value for a chart metric (null when it has none). */
export function sessionMetric(metric: ChartMetric, sets: CalcSet[]): number | null {
  switch (metric) {
    case 'e1rm': {
      const best = bestSet(sets)
      return best ? e1rm(best) : null
    }
    case 'best_set':
      return bestSet(sets)?.weightKg ?? null
    case 'volume': {
      const v = sessionVolume(sets)
      return v > 0 ? v : null
    }
    case 'max_reps':
      return maxReps(sets)
    case 'total_reps':
      return totalReps(sets)
    case 'duration':
      return longestDuration(sets)
  }
}

export type ChartPoint = { date: string; sessionId: string; value: number; isPR: boolean }

/**
 * One point per session (chronological input) from `from` (a `YYYY-MM-DD`, inclusive)
 * on; sessions without a value are skipped. PR points are where that session set a PR
 * of the metric's type.
 */
export function seriesForChart(
  type: ExerciseType,
  sessions: CalcSession[],
  metric: ChartMetric,
  from?: string,
): ChartPoint[] {
  const prType = METRIC_PR[metric]
  const prSessions = new Set(
    prTimeline(type, sessions)
      .filter((e) => e.prType === prType)
      .map((e) => e.sessionId),
  )
  return sessions.flatMap((s) => {
    if (from && s.date < from) return []
    const value = sessionMetric(metric, s.sets)
    return value === null
      ? []
      : [{ date: s.date, sessionId: s.sessionId, value, isPR: prSessions.has(s.sessionId) }]
  })
}
