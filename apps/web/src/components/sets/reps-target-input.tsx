import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** "8" → [8, null]; "8-12" / "8–12" → [8, 12]; "" → [null, null]; invalid → undefined. */
export function parseRepsTarget(text: string): [number | null, number | null] | undefined {
  const t = text.trim()
  if (t === '') return [null, null]
  const m = /^(\d{1,4})\s*(?:[-–]\s*(\d{1,4}))?$/.exec(t)
  if (!m) return undefined
  const low = Number(m[1])
  const high = m[2] === undefined ? null : Number(m[2])
  if (high !== null && high < low) return undefined
  return [low, high === low ? null : high]
}

export function formatRepsTarget(reps: number | null, repsMax: number | null): string {
  if (reps === null) return ''
  return repsMax === null ? String(reps) : `${reps}–${repsMax}`
}

/** Target reps or a range ("8–12"); committed on blur. */
export function RepsTargetInput({
  reps,
  repsMax,
  onCommit,
  className,
  ...props
}: {
  reps: number | null
  repsMax: number | null
  onCommit: (reps: number | null, repsMax: number | null) => void
  className?: string
  'aria-label': string
}) {
  const [text, setText] = useState(formatRepsTarget(reps, repsMax))
  const [invalid, setInvalid] = useState(false)
  useEffect(() => setText(formatRepsTarget(reps, repsMax)), [reps, repsMax])

  return (
    <Input
      {...props}
      inputMode="text"
      autoComplete="off"
      placeholder="8–12"
      value={text}
      aria-invalid={invalid}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        setText(e.target.value)
        setInvalid(false)
      }}
      onBlur={() => {
        const parsed = parseRepsTarget(text)
        if (!parsed) {
          setInvalid(true)
          return
        }
        setText(formatRepsTarget(...parsed))
        if (parsed[0] !== reps || parsed[1] !== repsMax) onCommit(...parsed)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className={cn(
        'tnum h-[52px] text-center text-[length:min(1.125rem,20px)] font-semibold placeholder:text-faint',
        className,
      )}
    />
  )
}
