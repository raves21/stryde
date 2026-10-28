import { format } from 'date-fns'
import { CalendarX } from 'lucide-react'
import { BottomSheet } from '@/components/app/bottom-sheet'
import { EmptyState } from '@/components/app/empty-state'
import type { Training } from '@/lib/training'
import { SessionListItem } from './session-list-item'

/** The workouts of one calendar day. */
export function DaySheet({
  day,
  training,
  onClose,
}: {
  day: string | null
  training: Training
  onClose: () => void
}) {
  const sessions = day ? training.sessions.filter((s) => s.session.localDate === day) : []
  return (
    <BottomSheet
      open={day !== null}
      onOpenChange={(open) => !open && onClose()}
      title={day ? format(new Date(`${day}T00:00:00`), 'EEEE, d MMMM') : ''}
    >
      {sessions.length === 0 ? (
        <EmptyState icon={CalendarX} title="No workout this day." />
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map((s) => (
            <SessionListItem key={s.session.id} summary={s} />
          ))}
        </div>
      )}
    </BottomSheet>
  )
}
