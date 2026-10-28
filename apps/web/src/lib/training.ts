import {
  type CalcSession,
  countedSets,
  type ExerciseRow,
  type PrEvent,
  prTimeline,
  type SessionRow,
  type SetRow,
  sessionVolume,
} from '@stryde/shared'
import { addDays, format, startOfMonth, startOfWeek, startOfYear } from 'date-fns'
import type { TrainingRows } from '@/db/repositories/sessions'

// History, calendar, stats and PR marks, derived from local rows with the shared calc
// module (PRODUCT_SPEC.md §4.4–4.5, §6). Pure, so it's tested without Dexie.

export type ExercisePR = PrEvent & { exercise: ExerciseRow }

export type SessionSummary = {
  session: SessionRow
  durationMs: number
  /** Completed working sets. */
  sets: number
  volumeKg: number
  /** Exercises with at least one completed set. */
  exercises: number
  prs: ExercisePR[]
}

/** One session's sets of one exercise, as full rows (for display) and calc input. */
export type ExerciseSession = Omit<CalcSession, 'sets'> & { sets: SetRow[] }

export type ExerciseHistory = {
  exercise: ExerciseRow
  /** Chronological. */
  sessions: ExerciseSession[]
  /** Every PR event, chronological. */
  events: PrEvent[]
  /** Current record per PR type. */
  records: PrEvent[]
}

export type Training = {
  /** Newest first. */
  sessions: SessionSummary[]
  byId: Map<string, SessionSummary>
  exercises: Map<string, ExerciseHistory>
  /** PR events by the set that achieved them (🏆 marks). */
  prsBySet: Map<string, ExercisePR[]>
  /** Calendar days with a finished session. */
  trainedDates: Set<string>
  /** Newest first. */
  recentPRs: ExercisePR[]
  /** Latest start per template ("last done 4d ago"). */
  lastDoneByTemplate: Map<string, string>
}

export function buildTraining(rows: TrainingRows): Training {
  const exerciseById = new Map(rows.exercises.map((e) => [e.id, e]))
  const setsBySe = new Map<string, SetRow[]>()
  for (const set of rows.sets) {
    const list = setsBySe.get(set.sessionExerciseId) ?? []
    list.push(set)
    setsBySe.set(set.sessionExerciseId, list)
  }
  const sesBySession = new Map<string, typeof rows.sessionExercises>()
  for (const se of rows.sessionExercises) {
    const list = sesBySession.get(se.sessionId) ?? []
    list.push(se)
    sesBySession.set(se.sessionId, list)
  }
  const chronological = [...rows.sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt))

  // Per-exercise chronological history → PR timeline.
  const exercises = new Map<string, ExerciseHistory>()
  for (const session of chronological) {
    const ses = (sesBySession.get(session.id) ?? []).sort((a, b) => a.position - b.position)
    for (const se of ses) {
      const exercise = exerciseById.get(se.exerciseId)
      if (!exercise) continue
      const sets = (setsBySe.get(se.id) ?? []).sort((a, b) => a.position - b.position)
      const entry = exercises.get(exercise.id) ?? {
        exercise,
        sessions: [],
        events: [],
        records: [],
      }
      const last = entry.sessions.at(-1)
      // The same exercise twice in one session counts as one session.
      if (last?.sessionId === session.id) last.sets.push(...sets)
      else
        entry.sessions.push({
          sessionId: session.id,
          date: session.localDate,
          at: session.finishedAt ?? session.startedAt,
          sets,
        })
      exercises.set(exercise.id, entry)
    }
  }
  const prsBySession = new Map<string, ExercisePR[]>()
  const prsBySet = new Map<string, ExercisePR[]>()
  const allPRs: ExercisePR[] = []
  for (const entry of exercises.values()) {
    entry.events = prTimeline(entry.exercise.type, entry.sessions)
    const latest = new Map<string, PrEvent>()
    for (const e of entry.events) {
      latest.set(e.prType, e)
      const pr = { ...e, exercise: entry.exercise }
      allPRs.push(pr)
      prsBySession.set(e.sessionId, [...(prsBySession.get(e.sessionId) ?? []), pr])
      if (e.setId) prsBySet.set(e.setId, [...(prsBySet.get(e.setId) ?? []), pr])
    }
    entry.records = [...latest.values()]
  }

  const summaries = chronological
    .map((session): SessionSummary => {
      const ses = sesBySession.get(session.id) ?? []
      const sets = ses.flatMap((se) => setsBySe.get(se.id) ?? [])
      return {
        session,
        durationMs:
          Date.parse(session.finishedAt ?? session.startedAt) - Date.parse(session.startedAt),
        sets: countedSets(sets).length,
        volumeKg: sessionVolume(sets),
        exercises: ses.filter((se) =>
          (setsBySe.get(se.id) ?? []).some((s) => s.completedAt !== null),
        ).length,
        prs: prsBySession.get(session.id) ?? [],
      }
    })
    .reverse()

  const lastDoneByTemplate = new Map<string, string>()
  for (const s of chronological) if (s.templateId) lastDoneByTemplate.set(s.templateId, s.startedAt)

  return {
    sessions: summaries,
    byId: new Map(summaries.map((s) => [s.session.id, s])),
    exercises,
    prsBySet,
    trainedDates: new Set(rows.sessions.map((s) => s.localDate)),
    recentPRs: allPRs.sort((a, b) => b.achievedAt.localeCompare(a.achievedAt)),
    lastDoneByTemplate,
  }
}

/** `YYYY-MM-DD` of a local date. */
export const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')

export type Stats = {
  week: number
  month: number
  year: number
  total: number
  volumeKg: number
  volumeMonthKg: number
  totalSets: number
}

/** Progress tab tiles (weeks start Monday; days are session `localDate`s). */
export function computeStats(training: Training, today: Date): Stats {
  const week = dayKey(startOfWeek(today, { weekStartsOn: 1 }))
  const month = dayKey(startOfMonth(today))
  const year = dayKey(startOfYear(today))
  const end = dayKey(today)
  const inRange = (from: string) =>
    training.sessions.filter((s) => s.session.localDate >= from && s.session.localDate <= end)
  return {
    week: inRange(week).length,
    month: inRange(month).length,
    year: inRange(year).length,
    total: training.sessions.length,
    volumeKg: training.sessions.reduce((v, s) => v + s.volumeKg, 0),
    volumeMonthKg: inRange(month).reduce((v, s) => v + s.volumeKg, 0),
    totalSets: training.sessions.reduce((v, s) => v + s.sets, 0),
  }
}

/** The 7 days (Mon–Sun) of `today`'s week as `YYYY-MM-DD`. */
export function weekDays(today: Date): string[] {
  const monday = startOfWeek(today, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => dayKey(addDays(monday, i)))
}
