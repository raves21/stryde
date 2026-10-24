import { cn } from '@/lib/utils'

export function ProgressDots({ count, current }: { count: number; current: number }) {
  return (
    <div
      className="flex gap-2"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={count}
      aria-valuenow={current + 1}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: static list of dots
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all',
            i === current ? 'w-6 bg-primary' : 'w-1.5 bg-surface-3',
          )}
        />
      ))}
    </div>
  )
}
