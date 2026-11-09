import { useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { SessionTree } from '@/db/repositories/sessions'
import { deleteSession, finishSportSession, updateSession } from '@/db/repositories/sessions'
import { SyncIndicator } from '@/features/sync/components/sync-indicator'
import { useNow } from '@/lib/use-now'
import { useWakeLock } from '@/lib/use-wake-lock'
import { formatElapsed } from '@/lib/workout'
import { requestSync } from '@/sync/controller'
import { useKeepScreenOn } from '../use-workout'
import { SportFinishSheet } from './sport-finish-sheet'

/**
 * A sport in progress: a big timer and notes, no sets. Finishing takes the minutes from the
 * timer (editable). Used instead of the workout screen when the session is a sport.
 */
export function ActiveSport({ tree }: { tree: SessionTree }) {
  const { session } = tree
  const navigate = useNavigate()
  const now = useNow()
  useWakeLock(useKeepScreenOn())
  const [notes, setNotes] = useState(session.notes ?? '')
  const [finishing, setFinishing] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const elapsedMs = Math.max(0, now - Date.parse(session.startedAt))

  async function save(values: {
    durationSec: number
    notes: string | null
    shareWithFriends: boolean
  }) {
    await finishSportSession(session.id, values)
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

      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col items-center gap-6 px-4 pt-12 pb-10">
        <div className="flex flex-col items-center gap-2">
          <p
            role="timer"
            aria-label="Time played"
            className="tnum font-display text-[88px] leading-none font-bold"
          >
            {formatElapsed(elapsedMs)}
          </p>
          <p className="text-muted-foreground">Started {format(session.startedAt, 'p')}</p>
        </div>

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

        <Button size="lg" className="w-full" onClick={() => setFinishing(true)}>
          Finish
        </Button>
        <Button variant="ghost" className="text-failure" onClick={() => setDiscarding(true)}>
          Discard
        </Button>
      </main>

      <SportFinishSheet
        tree={tree}
        open={finishing}
        onOpenChange={setFinishing}
        elapsedMs={elapsedMs}
        onSave={save}
      />
      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title={`Discard ${session.name}?`}
        description="The timer and your notes are deleted."
        confirmLabel="Discard"
        onConfirm={discard}
      />
    </div>
  )
}
