import { useEffect, useState } from 'react'
import { BottomSheet } from '@/components/app/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { SessionTree } from '@/db/repositories/sessions'
import { formatSpan } from '@/features/progress/use-training'
import { formatElapsed } from '@/lib/workout'

/** End a sport session: the games (the one on the clock counts), notes and sharing. */
export function SportFinishSheet({
  tree,
  open,
  onOpenChange,
  pendingMs,
  onSave,
}: {
  tree: SessionTree
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Time on the clock of the game in progress when the sheet was opened (0 = none). */
  pendingMs: number
  onSave: (values: { notes: string | null; shareWithFriends: boolean }) => Promise<void>
}) {
  const { session } = tree
  const [notes, setNotes] = useState(session.notes ?? '')
  const [share, setShare] = useState(session.shareWithFriends)
  const [saving, setSaving] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: only on open
  useEffect(() => {
    if (!open) return
    setNotes(session.notes ?? '')
    setShare(session.shareWithFriends)
  }, [open])

  const done = tree.exercises
    .flatMap((e) => e.sets)
    .filter((s) => s.completedAt !== null)
    .map((s) => ({ key: s.id, ms: (s.durationSec ?? 0) * 1000 }))
  const pending = Math.floor(pendingMs / 1000) >= 1 ? Math.floor(pendingMs / 1000) * 1000 : 0
  const games = pending > 0 ? [...done, { key: 'on-the-clock', ms: pending }] : done
  const total = games.reduce((sum, g) => sum + g.ms, 0)

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Finish ${session.name}`}
      footer={
        <Button
          size="lg"
          disabled={saving || games.length === 0}
          onClick={async () => {
            setSaving(true)
            try {
              await onSave({ notes: notes.trim() || null, shareWithFriends: share })
            } finally {
              setSaving(false)
            }
          }}
        >
          Save
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-1">
          <p className="tnum font-display text-5xl leading-none font-bold">{formatSpan(total)}</p>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {games.length === 0
              ? 'Finish at least one game to save.'
              : `${games.length} ${games.length === 1 ? 'game' : 'games'} played`}
          </p>
        </div>

        {games.length > 0 && (
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
            {games.map((g, i) => (
              <li
                key={g.key}
                className="flex justify-between border-border px-4 py-3 not-last:border-b"
              >
                <span className="font-medium">Game {i + 1}</span>
                <span className="tnum text-muted-foreground">{formatElapsed(g.ms)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="sport-notes">Notes</Label>
          <Textarea
            id="sport-notes"
            value={notes}
            maxLength={2000}
            rows={3}
            placeholder="How did it go?"
            onChange={(e) => setNotes(e.target.value)}
            className="bg-surface-2"
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="sport-share">Share with friends</Label>
            <p className="text-sm text-muted-foreground">
              Friends will be notified and can see this session.
            </p>
          </div>
          <Switch id="sport-share" checked={share} onCheckedChange={setShare} />
        </div>
      </div>
    </BottomSheet>
  )
}
