import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { ChartNoAxesColumn, House, Plus, UserRound, UsersRound } from 'lucide-react'

const TABS: { to: '/' | '/feed' | '/progress' | '/profile'; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Today', icon: House },
  { to: '/feed', label: 'Feed', icon: UsersRound },
  { to: '/progress', label: 'Progress', icon: ChartNoAxesColumn },
  { to: '/profile', label: 'Profile', icon: UserRound },
]

/** Fixed bottom navigation with the round center Start button (UI_DESIGN.md §3). */
export function TabBar() {
  const [today, feed, progress, profile] = TABS as [
    (typeof TABS)[0],
    (typeof TABS)[0],
    (typeof TABS)[0],
    (typeof TABS)[0],
  ]
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto grid h-16 max-w-[640px] grid-cols-5 items-center">
        <Tab {...today} />
        <Tab {...feed} />
        <div className="flex justify-center">
          {/* Phase 4 replaces this with the start-workout sheet. */}
          <Link
            to="/templates"
            aria-label="Start workout"
            className="flex size-14 -translate-y-3 items-center justify-center rounded-full bg-brand text-primary-foreground transition-transform active:scale-95"
          >
            <Plus className="size-7" strokeWidth={2.25} />
          </Link>
        </div>
        <Tab {...progress} />
        <Tab {...profile} />
      </div>
    </nav>
  )
}

function Tab({ to, label, icon: Icon }: (typeof TABS)[number]) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === '/' }}
      className="group flex h-full flex-col items-center justify-center gap-1 text-faint data-[status=active]:text-brand"
    >
      <Icon className="size-6" strokeWidth={1.75} aria-hidden />
      <span className="text-[11px] font-medium">{label}</span>
    </Link>
  )
}
