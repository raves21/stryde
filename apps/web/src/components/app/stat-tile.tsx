import { cn } from '@/lib/utils'

/** Big number + label (UI_DESIGN.md §6.2 `StatTile`). */
export function StatTile({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1 rounded-2xl border border-border bg-surface p-3',
        className,
      )}
    >
      <span className="tnum font-display text-[28px] leading-none font-semibold">{value}</span>
      <span className="text-center text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
