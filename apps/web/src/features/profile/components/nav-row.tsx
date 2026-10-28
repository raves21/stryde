import { Link, type LinkProps } from '@tanstack/react-router'
import { ChevronRight, type LucideIcon } from 'lucide-react'

/** Settings-style row with a chevron (UI_DESIGN.md §5.14). */
export function NavRow({
  to,
  icon: Icon,
  label,
}: {
  to: LinkProps['to']
  icon: LucideIcon
  label: string
}) {
  return (
    <Link
      to={to}
      className="flex min-h-14 items-center gap-3 border-border px-4 not-last:border-b hover:bg-surface-2"
    >
      <Icon className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden />
      <span className="flex-1 font-medium">{label}</span>
      <ChevronRight className="size-5 text-faint" aria-hidden />
    </Link>
  )
}
