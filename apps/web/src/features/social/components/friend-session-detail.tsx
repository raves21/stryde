import type { SessionDetail } from '@stryde/shared'
import { format } from 'date-fns'
import { Trophy } from 'lucide-react'
import { Screen } from '@/components/app/screen'
import { SectionLabel } from '@/components/app/section-label'
import { StatTile } from '@/components/app/stat-tile'
import { TopBar } from '@/components/app/top-bar'
import { UserAvatar } from '@/components/app/user-avatar'
import { SetTable } from '@/components/sets/set-table'
import { formatSpan } from '@/features/progress/use-training'
import { useUnit } from '@/features/settings/use-settings'
import { formatPR } from '@/features/workout/format-pr'
import { ReactionBar } from './reaction-bar'

/** A friend's shared workout, read-only, with their header and reactions (§5.6 friend view). */
export function FriendSessionDetail({ session }: { session: SessionDetail }) {
  const unit = useUnit()
  const { owner } = session
  const sets = session.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.setType === 'working').length,
    0,
  )
  return (
    <Screen className="pb-16">
      <TopBar title={session.name} back />
      <div className="-mt-4 flex items-center gap-3">
        <UserAvatar username={owner.username} displayName={owner.displayName} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{owner.isMe ? 'You' : owner.displayName}</span>
          <span className="tnum truncate text-sm text-muted-foreground">
            {format(session.startedAt, 'EEE d MMM yyyy')} · {format(session.startedAt, 'p')}–
            {format(session.finishedAt, 'p')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatTile
          label="Duration"
          value={formatSpan(Date.parse(session.finishedAt) - Date.parse(session.startedAt))}
        />
        <StatTile label="Sets" value={String(sets)} />
      </div>

      {session.prs.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Personal records</SectionLabel>
          {session.prs.map((pr) => (
            <div
              key={`${pr.exerciseId}-${pr.prType}`}
              className="flex items-center gap-3 rounded-2xl border border-pr/40 bg-pr/10 p-3"
            >
              <Trophy className="size-5 shrink-0 text-pr" aria-hidden />
              <p className="min-w-0 text-sm">
                <span className="font-semibold">{pr.exerciseName}</span>
                <span className="text-muted-foreground"> · </span>
                <span className="tnum text-pr">{formatPR({ ...pr, setId: null }, unit)}</span>
              </p>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        {session.exercises.map((exercise) => {
          return (
            <article
              key={exercise.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4"
            >
              <header className="flex items-center gap-2">
                {exercise.supersetGroup && (
                  <span className="rounded-full bg-brand-dim px-2 font-display text-sm font-bold text-brand">
                    {exercise.supersetGroup}
                  </span>
                )}
                <h2 className="truncate font-semibold">{exercise.name}</h2>
              </header>
              <SetTable sets={exercise.sets} type={exercise.type} unit={unit} />
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

      <section className="flex flex-col gap-2">
        <SectionLabel>Reactions</SectionLabel>
        <ReactionBar
          sessionId={session.id}
          reactions={session.reactions}
          myReaction={session.myReaction}
        />
      </section>
    </Screen>
  )
}
