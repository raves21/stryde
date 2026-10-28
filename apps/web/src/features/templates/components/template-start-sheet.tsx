import { Link } from '@tanstack/react-router'
import { Pencil, Play } from 'lucide-react'
import { BottomSheet } from '@/components/app/bottom-sheet'
import { Button } from '@/components/ui/button'
import { useStartWorkout } from '@/features/workout/use-start-workout'
import { useActiveSession } from '@/features/workout/use-workout'
import { useTemplateTree } from '../use-templates'

/** Tap a template on Today → preview + Start (UI_DESIGN.md §5.3). */
export function TemplateStartSheet({
  templateId,
  onClose,
}: {
  templateId: string | null
  onClose: () => void
}) {
  const tree = useTemplateTree(templateId ?? '')
  const active = useActiveSession()
  const { startTemplate } = useStartWorkout()

  return (
    <BottomSheet
      open={templateId !== null}
      onOpenChange={(open) => !open && onClose()}
      title={tree?.template.name ?? 'Template'}
      description={active ? 'Finish or discard the current workout to start another.' : undefined}
      footer={
        <>
          <Button
            size="lg"
            disabled={!tree || !!active}
            onClick={() => {
              onClose()
              if (templateId) void startTemplate(templateId)
            }}
          >
            <Play /> Start
          </Button>
          {templateId && (
            <Button variant="ghost" asChild>
              <Link to="/templates/$id" params={{ id: templateId }} onClick={onClose}>
                <Pencil /> Edit template
              </Link>
            </Button>
          )}
        </>
      }
    >
      {tree && (
        <ol className="flex flex-col gap-1">
          {tree.exercises.map(({ row, exercise, sets }) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-1.5">
              <span className="truncate">
                {row.supersetGroup && (
                  <span className="mr-2 font-display font-bold text-brand">
                    {row.supersetGroup}
                  </span>
                )}
                {exercise?.name ?? 'Unknown exercise'}
              </span>
              <span className="tnum shrink-0 text-sm text-muted-foreground">
                {sets.length} {sets.length === 1 ? 'set' : 'sets'}
              </span>
            </li>
          ))}
        </ol>
      )}
    </BottomSheet>
  )
}
