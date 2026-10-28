import type { ReactNode } from 'react'

/** A settings row: label (+ hint) left, control right (UI_DESIGN.md §5.14). */
export function SettingRow({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-14 items-center gap-3 border-border px-4 py-2 not-last:border-b">
      <div className="flex min-w-0 flex-1 flex-col">
        <label htmlFor={htmlFor} className="font-medium">
          {label}
        </label>
        {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
