import type { ReactNode } from 'react'

/** Uppercase Barlow section label (UI_DESIGN.md §2). */
export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {children}
      </h2>
      {action}
    </div>
  )
}
