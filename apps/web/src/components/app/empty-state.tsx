import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/** Icon + one short line + optional action (UI_DESIGN.md §7). */
export function EmptyState({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <Icon className="size-8 text-faint" strokeWidth={1.75} aria-hidden />
      <p className="max-w-xs text-muted-foreground">{title}</p>
      {action}
    </div>
  )
}
