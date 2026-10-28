import { useRouter } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { SyncIndicator } from '@/features/sync/components/sync-indicator'

/** Screen title (Barlow Condensed 28) with the sync indicator on the right (UI_DESIGN.md §3). */
export function TopBar({
  title,
  back = false,
  actions,
}: {
  title: ReactNode
  /** Show a back chevron (sub-pages). */
  back?: boolean
  /** Extra controls left of the sync indicator. */
  actions?: ReactNode
}) {
  const router = useRouter()
  return (
    <header className="sticky top-0 z-20 -mx-4 flex h-14 items-center gap-1 bg-background/95 px-4 pt-[env(safe-area-inset-top)]">
      {back && (
        <Button
          variant="ghost"
          size="icon"
          className="-ml-3"
          aria-label="Back"
          onClick={() => router.history.back()}
        >
          <ChevronLeft className="size-6" />
        </Button>
      )}
      <h1 className="min-w-0 flex-1 truncate font-display text-[28px] font-semibold leading-none">
        {title}
      </h1>
      {actions}
      <SyncIndicator />
    </header>
  )
}
