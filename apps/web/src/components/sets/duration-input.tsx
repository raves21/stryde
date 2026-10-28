import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatDuration, parseDuration } from '@/lib/workout'

/** mm:ss time field (timed exercises); committed on blur. */
export function DurationInput({
  value,
  onCommit,
  placeholder,
  className,
  ...props
}: {
  value: number | null
  onCommit: (seconds: number | null) => void
  placeholder?: string
  className?: string
  'aria-label': string
}) {
  const [text, setText] = useState(value === null ? '' : formatDuration(value))
  const [invalid, setInvalid] = useState(false)
  useEffect(() => setText(value === null ? '' : formatDuration(value)), [value])

  return (
    <Input
      {...props}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder ?? '0:00'}
      value={text}
      aria-invalid={invalid}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        setText(e.target.value)
        setInvalid(false)
      }}
      onBlur={() => {
        const parsed = parseDuration(text)
        if (parsed === undefined || (parsed !== null && parsed > 86_400)) {
          setInvalid(true)
          return
        }
        setText(parsed === null ? '' : formatDuration(parsed))
        if (parsed !== value) onCommit(parsed)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className={cn(
        'tnum h-[52px] px-1 text-center text-lg font-semibold placeholder:text-faint',
        className,
      )}
    />
  )
}
