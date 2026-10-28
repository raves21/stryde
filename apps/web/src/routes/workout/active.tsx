import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import type { SessionTree } from '@/db/repositories/sessions'
import { deleteSession, finishWorkout, updateSession } from '@/db/repositories/sessions'
import { SyncIndicator } from '@/features/sync/components/sync-indicator'
import { FinishSheet } from '@/features/workout/components/finish-sheet'
import { RestTimerBar } from '@/features/workout/components/rest-timer-bar'
import { WorkoutBody } from '@/features/workout/components/workout-body'
import { clearRestTimer } from '@/features/workout/rest-timer'
import { useActiveSession, useKeepScreenOn, useSessionTree } from '@/features/workout/use-workout'
import { useWorkoutActions } from '@/features/workout/use-workout-actions'
import { useNow } from '@/lib/use-now'
import { useWakeLock } from '@/lib/use-wake-lock'
import { formatElapsed } from '@/lib/workout'
import { requestSync } from '@/sync/controller'

export const Route = createFileRoute('/workout/active')({
  component: ActiveWorkoutPage,
})

function ActiveWorkoutPage() {
  const navigate = useNavigate()
  const active = useActiveSession()
  const tree = useSessionTree(active?.id)

  // Nothing active (finished elsewhere, discarded, never started): back to Today.
  useEffect(() => {
    if (active === null) void navigate({ to: '/', replace: true })
  }, [active, navigate])

  if (!active || !tree) return null
  return <ActiveWorkout tree={tree} />
}

function ActiveWorkout({ tree }: { tree: SessionTree }) {
  const { session } = tree
  const navigate = useNavigate()
  const actions = useWorkoutActions(tree, 'active')
  const now = useNow()
  useWakeLock(useKeepScreenOn())
  const [name, setName] = useState(session.name)
  const [notesOpen, setNotesOpen] = useState(session.notes !== null)
  const [notes, setNotes] = useState(session.notes ?? '')
  const [finishing, setFinishing] = useState(false)
  const [discarding, setDiscarding] = useState(false)

  const all = tree.exercises.flatMap((e) => e.sets)
  const done = all.filter((s) => s.completedAt !== null).length

  async function save(values: { notes: string | null; shareWithFriends: boolean }) {
    await finishWorkout(session.id, values)
    await clearRestTimer()
    requestSync()
    toast.success('Workout saved', {
      action: {
        label: 'Edit',
        onClick: () =>
          void navigate({ to: '/workout/$sessionId/edit', params: { sessionId: session.id } }),
      },
    })
    await navigate({ to: '/', replace: true })
  }

  async function discard() {
    await deleteSession(session.id)
    await clearRestTimer()
    toast('Workout discarded')
    await navigate({ to: '/', replace: true })
  }

  return (
    <div className="min-h-dvh pb-36">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-[640px] items-center gap-1 px-4">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-3"
            aria-label="Minimize workout"
            onClick={() => void navigate({ to: '/' })}
          >
            <ChevronDown className="size-6" />
          </Button>
          <div className="flex min-w-0 flex-1 flex-col">
            <Input
              aria-label="Workout name"
              value={name}
              maxLength={100}
              onChange={(e) => {
                setName(e.target.value)
                const v = e.target.value.trim()
                if (v) void updateSession(session.id, { name: v })
              }}
              className="h-7 border-none bg-transparent px-0 font-semibold dark:bg-transparent"
            />
            <span
              className="tnum font-display text-lg leading-none font-semibold text-brand"
              role="timer"
            >
              {formatElapsed(now - Date.parse(session.startedAt))}
            </span>
          </div>
          <SyncIndicator />
          <Button size="sm" onClick={() => setFinishing(true)}>
            Finish
          </Button>
        </div>
        <Progress
          value={all.length ? (done / all.length) * 100 : 0}
          aria-label={`${done} of ${all.length} sets done`}
          className="h-0.5 rounded-none bg-transparent"
        />
      </header>

      <main className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 pt-4">
        <WorkoutBody tree={tree} actions={actions} />

        {notesOpen ? (
          <Textarea
            aria-label="Workout notes"
            value={notes}
            maxLength={2000}
            rows={3}
            placeholder="Notes"
            autoFocus={session.notes === null}
            onChange={(e) => {
              setNotes(e.target.value)
              void updateSession(session.id, { notes: e.target.value.trim() || null })
            }}
            className="bg-surface-2"
          />
        ) : (
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => setNotesOpen(true)}
          >
            Add note
          </Button>
        )}

        <Button variant="ghost" className="text-failure" onClick={() => setDiscarding(true)}>
          Discard workout
        </Button>
      </main>

      <RestTimerBar />
      <FinishSheet tree={tree} open={finishing} onOpenChange={setFinishing} onSave={save} />
      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title="Discard this workout?"
        description="Everything logged in it is deleted."
        confirmLabel="Discard workout"
        onConfirm={discard}
      />
    </div>
  )
}
