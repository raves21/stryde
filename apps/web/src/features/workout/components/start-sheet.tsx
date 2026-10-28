import { ChevronRight, Play } from 'lucide-react'
import { BottomSheet } from '@/components/app/bottom-sheet'
import { SectionLabel } from '@/components/app/section-label'
import { Button } from '@/components/ui/button'
import { exercisePreview, useTemplateSummaries } from '@/features/templates/use-templates'
import { useStartWorkout } from '../use-start-workout'

/** Center button sheet: start empty or from a template. */
export function StartSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const templates = useTemplateSummaries()
  const { startEmpty, startTemplate } = useStartWorkout()

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Start workout">
      <div className="flex flex-col gap-5">
        <Button
          size="lg"
          onClick={() => {
            onOpenChange(false)
            void startEmpty()
          }}
        >
          <Play /> Start empty workout
        </Button>
        {templates && templates.length > 0 && (
          <section className="flex flex-col gap-2">
            <SectionLabel>From a template</SectionLabel>
            <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
              {templates.map((t) => (
                <li key={t.id} className="border-border not-last:border-b">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false)
                      void startTemplate(t.id)
                    }}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{t.name}</span>
                      <span className="truncate text-sm text-muted-foreground">
                        {exercisePreview(t.exerciseNames)}
                      </span>
                    </span>
                    <ChevronRight className="size-5 text-faint" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </BottomSheet>
  )
}
