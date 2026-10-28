import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { exercisePreview, useTemplateSummaries } from '../use-templates'

/** Horizontal scroll of template cards on Today (UI_DESIGN.md §5.3). */
export function TemplateStrip() {
  const templates = useTemplateSummaries()
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {templates?.map((t) => (
        <Link
          key={t.id}
          to="/templates/$id"
          params={{ id: t.id }}
          className="flex w-44 shrink-0 flex-col gap-1 rounded-2xl border border-border bg-surface p-4 hover:bg-surface-2"
        >
          <span className="truncate font-semibold">{t.name}</span>
          <span className="tnum text-sm text-muted-foreground">
            {t.exerciseNames.length} {t.exerciseNames.length === 1 ? 'exercise' : 'exercises'}
          </span>
          <span className="line-clamp-2 text-xs text-faint">
            {exercisePreview(t.exerciseNames)}
          </span>
        </Link>
      ))}
      <Link
        to="/templates/new"
        className="flex w-44 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-4 text-muted-foreground hover:bg-surface"
      >
        <Plus className="size-6" aria-hidden />
        <span className="text-sm font-medium">New template</span>
      </Link>
    </div>
  )
}
