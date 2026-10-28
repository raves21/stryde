import { format } from 'date-fns'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { deleteSession, finishSession } from '@/db/repositories/sessions'
import { useActiveSessions } from '../use-active-sessions'

/**
 * Two devices each started a workout offline (DATA_MODEL_AND_SYNC.md §8): once both
 * are synced, ask which to keep and finish or discard the rest.
 */
export function ActiveSessionConflictDialog() {
  const sessions = useActiveSessions()
  const [picked, setPicked] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const open = sessions.length > 1
  const keep = sessions.some((s) => s.id === picked) ? picked : (sessions[0]?.id ?? null)
  const others = sessions.filter((s) => s.id !== keep)
  const theOther = others.length === 1 ? 'the other' : 'the others'

  async function resolve(action: 'finish' | 'discard') {
    setPending(true)
    try {
      for (const s of others) {
        await (action === 'finish' ? finishSession(s.id) : deleteSession(s.id))
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{sessions.length} workouts in progress</DialogTitle>
          <DialogDescription>
            A workout was started on more than one device. Pick the one to continue.
          </DialogDescription>
        </DialogHeader>
        <ToggleGroup
          type="single"
          orientation="vertical"
          value={keep ?? ''}
          onValueChange={(v) => v && setPicked(v)}
          className="flex w-full flex-col gap-2"
          spacing={2}
          aria-label="Workout to keep"
        >
          {sessions.map((s) => (
            <ToggleGroupItem
              key={s.id}
              value={s.id}
              className="h-auto w-full flex-col items-start gap-0.5 rounded-xl bg-surface px-4 py-3 text-left data-[state=on]:bg-brand-dim"
            >
              <span className="font-medium">{s.name}</span>
              <span className="text-sm text-muted-foreground">
                Started {format(s.startedAt, 'EEE d MMM, p')}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={() => resolve('finish')} disabled={pending}>
            Keep this one, finish {theOther}
          </Button>
          <Button variant="ghost" onClick={() => resolve('discard')} disabled={pending}>
            Keep this one, discard {theOther}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
