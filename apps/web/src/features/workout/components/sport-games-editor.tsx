import { Trash2 } from 'lucide-react'
import { NumberInput } from '@/components/app/number-input'
import { SectionLabel } from '@/components/app/section-label'
import { Button } from '@/components/ui/button'
import type { SessionTree } from '@/db/repositories/sessions'
import { removeSet, updateSet } from '@/db/repositories/sets'

/** Fix the minutes of each game of a finished sport session, or remove a game. */
export function SportGamesEditor({ tree }: { tree: SessionTree }) {
  const games = tree.exercises.flatMap((e) => e.sets).filter((s) => s.completedAt !== null)
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>Games</SectionLabel>
      <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
        {games.map((g, i) => (
          <li
            key={g.id}
            className="flex items-center gap-3 border-border px-4 py-2 not-last:border-b"
          >
            <span className="flex-1 font-medium">Game {i + 1}</span>
            <NumberInput
              aria-label={`Game ${i + 1} minutes`}
              decimal
              suffix="min"
              className="w-28"
              value={Math.round(((g.durationSec ?? 0) / 60) * 100) / 100}
              onValueChange={(minutes) => {
                // A game needs at least a second; ignore empty or zero while typing.
                if (minutes === null || minutes * 60 < 1 || minutes > 24 * 60) return
                void updateSet(g.id, { durationSec: Math.round(minutes * 60) })
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove game ${i + 1}`}
              disabled={games.length < 2}
              onClick={() => void removeSet(g.id)}
            >
              <Trash2 className="size-5" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
