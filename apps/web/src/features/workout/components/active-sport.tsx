import { useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { ChevronDown, Pause, Play } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { SectionLabel } from '@/components/app/section-label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { SessionTree } from '@/db/repositories/sessions'
import {
  deleteSession,
  finishSportGame,
  finishSportSession,
  updateSession,
} from '@/db/repositories/sessions'
import { SyncIndicator } from '@/features/sync/components/sync-indicator'
import { useNow } from '@/lib/use-now'
import { useWakeLock } from '@/lib/use-wake-lock'
import { formatElapsed } from '@/lib/workout'
import { requestSync } from '@/sync/controller'
import {
  clearGameClock,
  pauseGameClock,
  readyGameClock,
  resetGameClock,
  resumeGameClock,
  startGameClock,
  timerElapsedMs,
  useGameClock,
} from '../sport-timer'
import { useKeepScreenOn } from '../use-workout'
import { SportFinishSheet } from './sport-finish-sheet'

/**
 * A sport in progress: one game at a time on a big clock that starts at 0:00, with Pause /
 * Resume and Finish game, the games played so far, and notes. "End session" saves the session.
 * Used instead of the workout screen when the session is a sport.
 */
export function ActiveSport({ tree }: { tree: SessionTree }) {
  const { session } = tree
  const navigate = useNavigate()
  useWakeLock(useKeepScreenOn())
  const sets = tree.exercises.flatMap((e) => e.sets)
  const games = sets.filter((s) => s.completedAt !== null)
  const open = sets.find((s) => s.completedAt === null)
  const clock = useGameClock(session.id, open?.id)
  const running = clock?.runningSince != null
  const now = useNow(250, running)
  const elapsedMs = timerElapsedMs(clock, now)
  const [notes, setNotes] = useState(session.notes ?? '')
  const [ending, setEnding] = useState(false)
  const [pendingMs, setPendingMs] = useState(0)
  const [discarding, setDiscarding] = useState(false)
  const gameNumber = games.length + 1

  async function finishGame() {
    if (!open) return
    const seconds = Math.round(timerElapsedMs(clock, Date.now()) / 1000)
    try {
      const { next } = await finishSportGame(session.id, seconds)
      await readyGameClock(session.id, next.id)
      requestSync()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the game')
    }
  }

  async function endSession(values: { notes: string | null; shareWithFriends: boolean }) {
    await finishSportSession(session.id, {
      pendingSec: Math.floor(pendingMs / 1000),
      ...values,
    })
    await clearGameClock()
    requestSync()
    toast.success(`${session.name} saved`, {
      action: {
        label: 'Edit',
        onClick: () =>
          void navigate({ to: '/workout/$sessionId/edit', params: { sessionId: session.id } }),
      },
    })
    await navigate({ to: '/', replace: true })
  }

  async function discard() {
    await clearGameClock()
    await deleteSession(session.id)
    toast(`${session.name} discarded`)
    await navigate({ to: '/', replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-[640px] items-center gap-1 px-4">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-3"
            aria-label="Minimize"
            onClick={() => void navigate({ to: '/' })}
          >
            <ChevronDown className="size-6" />
          </Button>
          <h1 className="min-w-0 flex-1 truncate font-display text-2xl leading-[1.25] font-semibold">
            {session.name}
          </h1>
          <SyncIndicator />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col items-center gap-6 px-4 pt-10 pb-10">
        <div className="flex flex-col items-center gap-2">
          <p className="font-display text-sm font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Game {gameNumber}
            {clock && !running && elapsedMs > 0 ? ' · Paused' : ''}
          </p>
          <p
            role="timer"
            aria-label={`Game ${gameNumber} time`}
            className="tnum font-display text-[88px] leading-none font-bold"
          >
            {formatElapsed(elapsedMs)}
          </p>
          <p className="text-muted-foreground">Session started {format(session.startedAt, 'p')}</p>
        </div>

        <div className="flex w-full flex-col gap-2">
          {!clock || (!running && elapsedMs === 0) ? (
            <Button
              size="lg"
              className="w-full"
              disabled={!open}
              onClick={() => open && void startGameClock(session.id, open.id)}
            >
              <Play /> Start game {gameNumber}
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                variant="secondary"
                className="w-full"
                onClick={() => void (running ? pauseGameClock() : resumeGameClock())}
              >
                {running ? (
                  <>
                    <Pause /> Pause
                  </>
                ) : (
                  <>
                    <Play /> Resume
                  </>
                )}
              </Button>
              <Button
                size="lg"
                className="w-full"
                disabled={elapsedMs < 1000}
                onClick={() => void finishGame()}
              >
                Finish game {gameNumber}
              </Button>
              {!running && (
                <Button variant="ghost" onClick={() => void resetGameClock()}>
                  Reset to 0:00
                </Button>
              )}
            </>
          )}
        </div>

        {games.length > 0 && (
          <section className="flex w-full flex-col gap-2">
            <SectionLabel>Games</SectionLabel>
            <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
              {games.map((g, i) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between border-border px-4 py-3 not-last:border-b"
                >
                  <span className="font-medium">Game {i + 1}</span>
                  <span className="tnum text-muted-foreground">
                    {formatElapsed((g.durationSec ?? 0) * 1000)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Textarea
          aria-label="Notes"
          value={notes}
          maxLength={2000}
          rows={3}
          placeholder="Notes (optional)"
          onChange={(e) => {
            setNotes(e.target.value)
            void updateSession(session.id, { notes: e.target.value.trim() || null })
          }}
          className="bg-surface-2"
        />

        <Button
          size="lg"
          variant={games.length > 0 ? 'default' : 'secondary'}
          className="w-full"
          onClick={() => {
            // Stop the clock so the game on it is counted exactly as shown.
            setPendingMs(timerElapsedMs(clock, Date.now()))
            void pauseGameClock()
            setEnding(true)
          }}
        >
          End session
        </Button>
        <Button variant="ghost" className="text-failure" onClick={() => setDiscarding(true)}>
          Discard
        </Button>
      </main>

      <SportFinishSheet
        tree={tree}
        open={ending}
        onOpenChange={setEnding}
        pendingMs={pendingMs}
        onSave={endSession}
      />
      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title={`Discard ${session.name}?`}
        description="Every game and your notes are deleted."
        confirmLabel="Discard"
        onConfirm={discard}
      />
    </div>
  )
}
