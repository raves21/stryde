import { toDisplayWeight } from '@stryde/shared'
import { format } from 'date-fns'
import { TriangleAlert, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BottomSheet } from '@/components/app/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { SessionTree } from '@/db/repositories/sessions'
import { useUnit } from '@/features/settings/use-settings'
import { useNow } from '@/lib/use-now'
import { formatElapsed } from '@/lib/workout'
import { formatPR } from '../format-pr'
import { useFinishSummary } from '../use-finish-summary'

/** Finish workout sheet (UI_DESIGN.md §5.5). */
export function FinishSheet({
  tree,
  open,
  onOpenChange,
  onSave,
}: {
  tree: SessionTree
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (values: { notes: string | null; shareWithFriends: boolean }) => Promise<void>
}) {
  const { session } = tree
  const unit = useUnit()
  const now = useNow(1000, open)
  const summary = useFinishSummary(tree, open)
  const [notes, setNotes] = useState(session.notes ?? '')
  const [share, setShare] = useState(session.shareWithFriends)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setNotes(session.notes ?? '')
    setShare(session.shareWithFriends)
  }, [open, session.notes, session.shareWithFriends])

  const nothingDone = summary !== undefined && summary.exercises === 0

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Finish workout"
      className="h-[94dvh] max-h-[94dvh]"
      footer={
        <Button
          size="lg"
          disabled={saving || !summary || nothingDone}
          onClick={async () => {
            setSaving(true)
            try {
              await onSave({ notes: notes.trim() || null, shareWithFriends: share })
            } finally {
              setSaving(false)
            }
          }}
        >
          Save workout
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-1 pt-2 text-center">
          <p className="tnum font-display text-[64px] leading-none font-bold">
            {formatElapsed(now - Date.parse(session.startedAt))}
          </p>
          <p className="font-medium">{session.name}</p>
          <p className="text-sm text-muted-foreground">
            {format(session.startedAt, 'EEEE, d MMMM')}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Sets" value={summary ? String(summary.sets) : '–'} />
          <Stat
            label={`Volume (${unit})`}
            value={summary ? toDisplayWeight(summary.volumeKg, unit, 0).toLocaleString() : '–'}
          />
          <Stat label="Exercises" value={summary ? String(summary.exercises) : '–'} />
        </div>

        {summary && summary.prs.length > 0 && (
          <section className="relative flex flex-col gap-2" aria-label="Personal records">
            <PRBurst />
            {summary.prs.map((pr) => (
              <div
                key={`${pr.exercise.id}-${pr.prType}`}
                className="flex items-center gap-3 rounded-2xl border border-pr/40 bg-pr/10 p-3"
              >
                <Trophy className="size-5 shrink-0 text-pr" aria-hidden />
                <p className="min-w-0 text-sm">
                  <span className="font-semibold">{pr.exercise.name}</span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="tnum text-pr">{formatPR(pr, unit)}</span>
                </p>
              </div>
            ))}
          </section>
        )}

        {nothingDone ? (
          <Notice>Complete at least one set to save, or discard the workout.</Notice>
        ) : (
          summary &&
          summary.incomplete > 0 && (
            <Notice
              action={
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                  Go back
                </Button>
              }
            >
              {summary.incomplete === 1
                ? '1 set not completed will be discarded.'
                : `${summary.incomplete} sets not completed will be discarded.`}
            </Notice>
          )
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="finish-notes">Notes</Label>
          <Textarea
            id="finish-notes"
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
            <Label htmlFor="finish-share">Share with friends</Label>
            <p className="text-sm text-muted-foreground">
              Friends will be notified and can see this workout.
            </p>
          </div>
          <Switch id="finish-share" checked={share} onCheckedChange={setShare} />
        </div>
      </div>
    </BottomSheet>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-surface-2 p-3">
      <span className="tnum font-display text-[28px] leading-none font-semibold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function Notice({ children, action }: { children: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-warning">
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">{children}</span>
      {action}
    </div>
  )
}

/** A brief gold + volt sparkle, once; hidden with reduced motion. */
function PRBurst() {
  const dots = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2
    return {
      x: `${Math.cos(angle) * 120}px`,
      y: `${Math.sin(angle) * 70}px`,
      color: i % 2 ? 'var(--pr)' : 'var(--accent-brand)',
    }
  })
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center motion-reduce:hidden"
      aria-hidden
    >
      {dots.map((d) => (
        <span
          key={`${d.x}${d.y}`}
          className="absolute size-1.5 rounded-full"
          style={
            {
              background: d.color,
              '--burst-x': d.x,
              '--burst-y': d.y,
              animation: 'pr-burst 700ms ease-out forwards',
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
