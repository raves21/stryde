import { Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Gold trophy chip; with a count or a label (UI_DESIGN.md §6.2 `PRBadge`). */
export function PRBadge({
  count,
  label,
  className,
}: {
  count?: number
  label?: string
  className?: string
}) {
  const text = label ?? (count !== undefined ? `${count} ${count === 1 ? 'PR' : 'PRs'}` : 'PR')
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-pr/15 px-2 py-0.5 text-xs font-semibold text-pr',
        className,
      )}
    >
      <Trophy className="size-3.5" aria-hidden />
      {text}
    </span>
  )
}
