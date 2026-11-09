import { useEffect, useState } from 'react'
import { BottomSheet } from '@/components/app/bottom-sheet'
import { NumberInput } from '@/components/app/number-input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { SessionTree } from '@/db/repositories/sessions'
import { formatSpan } from '@/features/progress/use-training'

/** Finish a sport: the timer's minutes (editable), notes and sharing. */
export function SportFinishSheet({
  tree,
  open,
  onOpenChange,
  elapsedMs,
  onSave,
}: {
  tree: SessionTree
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Time on the timer when the sheet was opened. */
  elapsedMs: number
  onSave: (values: {
    durationSec: number
    notes: string | null
    shareWithFriends: boolean
  }) => Promise<void>
}) {
  const { session } = tree
  const [minutes, setMinutes] = useState<number | null>(1)
  const [notes, setNotes] = useState(session.notes ?? '')
  const [share, setShare] = useState(session.shareWithFriends)
  const [saving, setSaving] = useState(false)

  // Start from the timer each time the sheet opens (not while it is open and ticking).
  // biome-ignore lint/correctness/useExhaustiveDependencies: only on open
  useEffect(() => {
    if (!open) return
    setMinutes(Math.max(1, Math.round(elapsedMs / 60_000)))
    setNotes(session.notes ?? '')
    setShare(session.shareWithFriends)
  }, [open])

  const valid = minutes !== null && minutes >= 1 && minutes <= 24 * 60

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Finish ${session.name}`}
      footer={
        <Button
          size="lg"
          disabled={saving || !valid}
          onClick={async () => {
            if (minutes === null) return
            setSaving(true)
            try {
              await onSave({
                durationSec: minutes * 60,
                notes: notes.trim() || null,
                shareWithFriends: share,
              })
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
        <div className="flex flex-col items-center gap-3">
          <Label htmlFor="sport-minutes">Minutes played</Label>
          <NumberInput
            id="sport-minutes"
            value={minutes}
            onValueChange={setMinutes}
            suffix="min"
            className="h-16 w-40 text-[length:28px]"
          />
          <p className="tnum text-sm text-muted-foreground" aria-live="polite">
            {valid && minutes !== null ? formatSpan(minutes * 60_000) : 'Enter 1 to 1440 minutes'}
          </p>
        </div>

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
