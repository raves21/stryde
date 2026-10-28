import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SearchX } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/app/empty-state'
import { Screen } from '@/components/app/screen'
import { TopBar } from '@/components/app/top-bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { SessionTree } from '@/db/repositories/sessions'
import { updateSession, updateSessionTimes } from '@/db/repositories/sessions'
import { WorkoutBody } from '@/features/workout/components/workout-body'
import { useSessionTree } from '@/features/workout/use-workout'
import { useWorkoutActions } from '@/features/workout/use-workout-actions'

export const Route = createFileRoute('/workout/$sessionId/edit')({
  component: EditSessionPage,
})

function EditSessionPage() {
  const { sessionId } = Route.useParams()
  const tree = useSessionTree(sessionId)
  if (tree === undefined) return null
  if (tree === null || tree.session.finishedAt === null) {
    return (
      <Screen>
        <TopBar title="Edit workout" back />
        <EmptyState
          icon={SearchX}
          title="This workout doesn't exist, was deleted, or is still in progress."
        />
      </Screen>
    )
  }
  return <EditSession tree={tree} />
}

/** `datetime-local` value (local time, minutes) ↔ ISO. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

/** Edit a finished session: same cards, no timers; times, notes and sharing editable. */
function EditSession({ tree }: { tree: SessionTree }) {
  const { session } = tree
  const navigate = useNavigate()
  const actions = useWorkoutActions(tree, 'edit')
  const [name, setName] = useState(session.name)
  const [notes, setNotes] = useState(session.notes ?? '')

  function setTimes(startedAt: string, finishedAt: string) {
    if (Date.parse(finishedAt) < Date.parse(startedAt)) {
      toast.error('The workout can’t end before it starts')
      return
    }
    void updateSessionTimes(session.id, startedAt, finishedAt)
  }

  return (
    <Screen className="pb-16">
      <TopBar
        title="Edit workout"
        back
        actions={
          <Button
            size="sm"
            onClick={() =>
              void navigate({ to: '/workout/$sessionId', params: { sessionId: session.id } })
            }
          >
            Done
          </Button>
        }
      />
      <div className="-mt-2 flex flex-col gap-4">
        <Input
          aria-label="Workout name"
          value={name}
          maxLength={100}
          onChange={(e) => {
            setName(e.target.value)
            const v = e.target.value.trim()
            if (v) void updateSession(session.id, { name: v })
          }}
          className="h-14 border-none bg-transparent px-0 font-display text-[28px] font-semibold dark:bg-transparent"
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-start">Started</Label>
            <Input
              id="edit-start"
              type="datetime-local"
              defaultValue={toLocalInput(session.startedAt)}
              onBlur={(e) =>
                e.target.value &&
                setTimes(new Date(e.target.value).toISOString(), session.finishedAt ?? '')
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-finish">Finished</Label>
            <Input
              id="edit-finish"
              type="datetime-local"
              defaultValue={session.finishedAt ? toLocalInput(session.finishedAt) : ''}
              onBlur={(e) =>
                e.target.value &&
                setTimes(session.startedAt, new Date(e.target.value).toISOString())
              }
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="edit-share">Share with friends</Label>
          <Switch
            id="edit-share"
            checked={session.shareWithFriends}
            onCheckedChange={(shareWithFriends) =>
              void updateSession(session.id, { shareWithFriends })
            }
          />
        </div>
      </div>

      <WorkoutBody tree={tree} actions={actions} />

      <Textarea
        aria-label="Workout notes"
        value={notes}
        maxLength={2000}
        rows={3}
        placeholder="Notes"
        onChange={(e) => {
          setNotes(e.target.value)
          void updateSession(session.id, { notes: e.target.value.trim() || null })
        }}
        className="bg-surface-2"
      />
    </Screen>
  )
}
