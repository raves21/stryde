import { Link, useNavigate } from '@tanstack/react-router'
import { Copy, Ellipsis, Play, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  deleteTemplate,
  duplicateTemplate,
  type TemplateSummary,
} from '@/db/repositories/templates'
import { useStartWorkout } from '@/features/workout/use-start-workout'
import { useActiveSession } from '@/features/workout/use-workout'
import { exercisePreview } from '../use-templates'

/** Templates list card: name, exercise preview, Start, ⋯ (UI_DESIGN.md §5.8). */
export function TemplateCard({ template }: { template: TemplateSummary }) {
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const active = useActiveSession()
  const { startTemplate } = useStartWorkout()

  return (
    <article className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-4">
      <Link
        to="/templates/$id"
        params={{ id: template.id }}
        className="flex min-w-0 flex-1 flex-col gap-1"
      >
        <h2 className="truncate text-lg font-semibold">{template.name}</h2>
        <p className="truncate text-sm text-muted-foreground">
          {exercisePreview(template.exerciseNames)}
        </p>
      </Link>
      <Button
        size="sm"
        disabled={!!active}
        aria-label={`Start ${template.name}`}
        title={active ? 'A workout is already in progress' : undefined}
        onClick={() => void startTemplate(template.id)}
      >
        <Play /> Start
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="-mr-2"
            aria-label={`${template.name} options`}
          >
            <Ellipsis className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={async () => {
              const copy = await duplicateTemplate(template.id)
              toast.success(`Created ${copy.name}`)
            }}
          >
            <Copy /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${template.name}?`}
        description="Workouts you already did from this template keep their history."
        confirmLabel="Delete template"
        onConfirm={async () => {
          await deleteTemplate(template.id)
          await navigate({ to: '/templates' })
        }}
      />
    </article>
  )
}
