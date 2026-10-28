import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Page container: 16px side padding, max 640px wide (UI_DESIGN.md §2). */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cn('mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 pb-8', className)}>
      {children}
    </main>
  )
}
