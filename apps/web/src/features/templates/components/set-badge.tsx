import type { SetType, TargetKind } from '@stryde/shared'
import { cn } from '@/lib/utils'

/** Set number cell: `W` for warm-ups, else the working-set number, with a target tag (UI_DESIGN.md §5.4). */
export function SetBadge({
  setType,
  number,
  targetKind,
  targetRir,
  className,
}: {
  setType: SetType
  number: number
  targetKind: TargetKind
  targetRir: number | null
  className?: string
}) {
  return (
    <span className={cn('flex flex-col items-center gap-0.5', className)}>
      <span
        className={cn(
          'flex size-8 items-center justify-center rounded-lg font-display text-base font-bold',
          setType === 'warmup' ? 'bg-surface-3 text-warmup' : 'bg-surface-3 text-foreground',
        )}
      >
        {setType === 'warmup' ? 'W' : number}
      </span>
      {targetKind === 'rir' && targetRir !== null && (
        <span className="font-display text-xs font-bold text-rir">@{targetRir}</span>
      )}
      {targetKind === 'failure' && (
        <span className="rounded bg-failure/15 px-1 font-display text-xs font-bold text-failure">
          F
        </span>
      )}
    </span>
  )
}
