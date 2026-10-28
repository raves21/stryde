import { toDisplayWeight } from '@stryde/shared'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Ellipsis, Eye, EyeOff, Pencil, SearchX, Trash2, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { EmptyState } from '@/components/app/empty-state'
import { Screen } from '@/components/app/screen'
import { SectionLabel } from '@/components/app/section-label'
import { StatTile } from '@/components/app/stat-tile'
import { TopBar } from '@/components/app/top-bar'
import { SetBadge } from '@/components/sets/set-badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { deleteSession, type SessionTree, updateSession } from '@/db/repositories/sessions'
import { formatSpan, useTraining } from '@/features/progress/use-training'
import { useUnit } from '@/features/settings/use-settings'
import { formatPR } from '@/features/workout/format-pr'
import { useSessionTree } from '@/features/workout/use-workout'
import type { Training } from '@/lib/training'
import { formatSetLine } from '@/lib/workout'

export const Route = createFileRoute('/workout/$sessionId/')({
  component: SessionDetailPage,
})

function SessionDetailPage() {
  const { sessionId } = Route.useParams()
  const tree = useSessionTree(sessionId)
  const training = useTraining()
  const navigate = useNavigate()

  // The active workout has its own screen.
  useEffect(() => {
    if (tree && tree.session.finishedAt === null)
      void navigate({ to: '/workout/active', replace: true })
  }, [tree, navigate])

  if (tree === undefined || !training) return null
  if (tree === null) {
    return (
      <Screen>
        <TopBar title="Workout" back />
        <EmptyState icon={SearchX} title="This workout doesn't exist or was deleted." />
      </Screen>
    )
  }
  if (tree.session.finishedAt === null) return null
  return <SessionDetail tree={tree} training={training} />
}

/** Session detail, own view (UI_DESIGN.md §5.6). */
function SessionDetail({ tree, training }: { tree: SessionTree; training: Training }) {
  const { session } = tree
  const unit = useUnit()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const summary = training.byId.get(session.id)
  const finishedAt = session.finishedAt ?? session.startedAt

  return (
    <Screen className="pb-16">
      <TopBar
        title={session.name}
        back
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Workout options">
                <Ellipsis className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/workout/$sessionId/edit" params={{ sessionId: session.id }}>
                  <Pencil /> Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <div className="-mt-4 flex items-center justify-between gap-2">
        <p className="tnum text-muted-foreground">
          {format(session.startedAt, 'EEE d MMM yyyy')} · {format(session.startedAt, 'p')}–
          {format(finishedAt, 'p')}
        </p>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={session.shareWithFriends}
          onClick={() =>
            void updateSession(session.id, { shareWithFriends: !session.shareWithFriends })
          }
          className="text-muted-foreground"
        >
          {session.shareWithFriends ? <Eye /> : <EyeOff />}
          {session.shareWithFriends ? 'Shared' : 'Private'}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Duration" value={formatSpan(summary?.durationMs ?? 0)} />
        <StatTile label="Sets" value={String(summary?.sets ?? 0)} />
        <StatTile
          label={`Volume (${unit})`}
          value={toDisplayWeight(summary?.volumeKg ?? 0, unit, 0).toLocaleString()}
        />
      </div>

      {summary && summary.prs.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Personal records</SectionLabel>
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

      <section className="flex flex-col gap-3">
        {tree.exercises.map(({ row, exercise, sets }) => {
          const done = sets.filter((s) => s.completedAt !== null)
          let working = 0
          return (
            <article
              key={row.id}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4"
            >
              <header className="flex items-center gap-2">
                {row.supersetGroup && (
                  <span className="rounded-full bg-brand-dim px-2 font-display text-sm font-bold text-brand">
                    {row.supersetGroup}
                  </span>
                )}
                {exercise ? (
                  <Link
                    to="/exercises/$id"
                    params={{ id: exercise.id }}
                    className="truncate font-semibold hover:underline"
                  >
                    {exercise.name}
                  </Link>
                ) : (
                  <span className="font-semibold">Unknown exercise</span>
                )}
              </header>
              <ol className="flex flex-col gap-1">
                {done.map((set) => {
                  if (set.setType === 'working') working += 1
                  const prs = training.prsBySet.get(set.id) ?? []
                  return (
                    <li key={set.id} className="flex items-center gap-3">
                      <SetBadge
                        setType={set.setType}
                        number={working}
                        targetKind={set.targetKind}
                        targetRir={null}
                        className="w-8 flex-row"
                      />
                      <span className="tnum flex-1">
                        {formatSetLine(set, exercise?.type ?? 'weighted', unit)}
                      </span>
                      {prs.length > 0 && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-pr">
                          <Trophy className="size-4" aria-hidden />
                          <span className="sr-only">Personal record</span>
                        </span>
                      )}
                    </li>
                  )
                })}
              </ol>
            </article>
          )
        })}
      </section>

      {session.notes && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Notes</SectionLabel>
          <p className="whitespace-pre-wrap text-muted-foreground">{session.notes}</p>
        </section>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this workout?"
        description="It's removed from your history, calendar and records."
        confirmLabel="Delete workout"
        onConfirm={async () => {
          await deleteSession(session.id)
          toast('Workout deleted')
          await navigate({ to: '/history', replace: true })
        }}
      />
    </Screen>
  )
}
