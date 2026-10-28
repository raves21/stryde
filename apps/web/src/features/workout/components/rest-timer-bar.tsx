import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'
import { formatElapsed } from '@/lib/workout'
import { adjustRestTimer, clearRestTimer, useRestTimer } from '../rest-timer'

const DISMISS_AFTER_MS = 3000

/** Rest countdown over the bottom of the workout screen (UI_DESIGN.md §5.4). */
export function RestTimerBar() {
  const timer = useRestTimer()
  const now = useNow(250, timer !== null)
  const buzzed = useRef<string | null>(null)
  const remaining = timer ? Date.parse(timer.endsAt) - now : 0
  const done = timer !== null && remaining <= 0

  useEffect(() => {
    if (!timer || !done) return
    if (buzzed.current !== timer.endsAt) {
      buzzed.current = timer.endsAt
      navigator.vibrate?.([200, 100, 200])
    }
    const id = setTimeout(
      () => void clearRestTimer(timer.setId),
      Math.max(0, DISMISS_AFTER_MS + remaining),
    )
    return () => clearTimeout(id)
  }, [timer, done, remaining])

  if (!timer || remaining <= -DISMISS_AFTER_MS) return null
  const progress = Math.min(1, Math.max(0, remaining / (timer.durationSec * 1000)))

  return (
    <div
      role="timer"
      aria-label="Rest timer"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-brand bg-surface pb-[env(safe-area-inset-bottom)]',
        done && 'motion-safe:animate-[rest-done_600ms_ease-in-out_2]',
      )}
    >
      <div className="h-1 bg-surface-3">
        <div
          className="h-full bg-brand transition-[width] duration-200"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="mx-auto flex max-w-[640px] items-center gap-2 px-4 py-2">
        <div className="flex flex-1 flex-col">
          <span className="text-xs text-muted-foreground">{done ? 'Rest done' : 'Rest'}</span>
          <span className="tnum font-display text-[40px] leading-none font-bold">
            {formatElapsed(Math.max(0, Math.ceil(remaining / 1000) * 1000))}
          </span>
        </div>
        <Button
          variant="secondary"
          size="icon"
          aria-label="15 seconds less"
          onClick={() => void adjustRestTimer(-15)}
        >
          −15
        </Button>
        <Button
          variant="secondary"
          size="icon"
          aria-label="15 seconds more"
          onClick={() => void adjustRestTimer(15)}
        >
          +15
        </Button>
        <Button variant="ghost" onClick={() => void clearRestTimer()}>
          Skip
        </Button>
      </div>
    </div>
  )
}
