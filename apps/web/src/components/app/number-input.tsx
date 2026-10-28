import { type ComponentProps, useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Props = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: number | null
  /** Called with the parsed number (null when cleared) on every valid edit. */
  onValueChange: (value: number | null) => void
  /** Allow decimals (weights) or whole numbers only (reps, RIR). */
  decimal?: boolean
  suffix?: string
}

/** Large, centered, tabular number field; selects all on focus (UI_DESIGN.md §5.4). */
export function NumberInput({
  value,
  onValueChange,
  decimal = false,
  suffix,
  className,
  ...props
}: Props) {
  const [text, setText] = useState(value === null ? '' : String(value))
  const focused = useRef(false)

  // Follow external changes (e.g. sync), but never while the user is typing: unit
  // conversion round-trips aren't exact and would rewrite the field mid-edit.
  useEffect(() => {
    if (focused.current) return
    setText((current) =>
      parse(current, decimal) === value ? current : value === null ? '' : String(value),
    )
  }, [value, decimal])

  return (
    <div className="relative">
      <Input
        {...props}
        type="text"
        inputMode={decimal ? 'decimal' : 'numeric'}
        autoComplete="off"
        value={text}
        onFocus={(e) => {
          focused.current = true
          e.currentTarget.select()
          props.onFocus?.(e)
        }}
        onBlur={(e) => {
          focused.current = false
          setText(value === null ? '' : String(value))
          props.onBlur?.(e)
        }}
        onChange={(e) => {
          const next = e.target.value.replace(',', '.')
          const pattern = decimal ? /^\d*\.?\d*$/ : /^\d*$/
          if (!pattern.test(next)) return
          setText(next)
          const parsed = parse(next, decimal)
          if (parsed !== undefined) onValueChange(parsed)
        }}
        className={cn(
          'tnum h-[52px] text-center text-lg font-semibold',
          suffix && 'pr-8',
          className,
        )}
      />
      {suffix && (
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-faint uppercase">
          {suffix}
        </span>
      )}
    </div>
  )
}

/** null for empty, undefined while incomplete (e.g. "12."), else the number. */
function parse(text: string, decimal: boolean): number | null | undefined {
  if (text === '') return null
  if (decimal && text.endsWith('.')) return undefined
  const n = Number(text)
  return Number.isFinite(n) ? n : undefined
}
