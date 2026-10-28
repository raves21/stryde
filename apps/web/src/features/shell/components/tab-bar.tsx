import { Link } from '@tanstack/react-router'
import {
  ChartNoAxesColumn,
  House,
  type LucideIcon,
  Plus,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { useState } from 'react'
import { StartSheet } from '@/features/workout/components/start-sheet'
import { useActiveSession } from '@/features/workout/use-workout'
import { useNow } from '@/lib/use-now'
import { formatElapsed } from '@/lib/workout'

type Tab = { to: '/' | '/feed' | '/progress' | '/profile'; label: string; icon: LucideIcon }

/** Fixed bottom navigation with the round center Start button (UI_DESIGN.md §3). */
export function TabBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto grid h-16 max-w-[640px] grid-cols-5 items-center">
        <TabLink to="/" label="Today" icon={House} />
        <TabLink to="/feed" label="Feed" icon={UsersRound} />
        <div className="flex justify-center">
          <CenterButton />
        </div>
        <TabLink to="/progress" label="Progress" icon={ChartNoAxesColumn} />
        <TabLink to="/profile" label="Profile" icon={UserRound} />
      </div>
    </nav>
  )
}

const round =
  'flex size-14 -translate-y-3 items-center justify-center rounded-full bg-brand text-primary-foreground transition-transform active:scale-95'

/** Start (opens the start sheet) or, with a workout running, Resume showing elapsed time. */
function CenterButton() {
  const active = useActiveSession()
  const now = useNow(1000, !!active)
  const [starting, setStarting] = useState(false)

  if (active) {
    return (
      <Link
        to="/workout/active"
        aria-label={`Resume ${active.name}`}
        className={`${round} relative`}
      >
        <span
          className="absolute inset-0 rounded-full ring-2 ring-brand motion-safe:animate-ping"
          aria-hidden
        />
        <span className="tnum font-display text-sm font-bold">
          {formatElapsed(now - Date.parse(active.startedAt))}
        </span>
      </Link>
    )
  }
  return (
    <>
      <button
        type="button"
        aria-label="Start workout"
        className={round}
        onClick={() => setStarting(true)}
      >
        <Plus className="size-7" strokeWidth={2.25} />
      </button>
      <StartSheet open={starting} onOpenChange={setStarting} />
    </>
  )
}

function TabLink({ to, label, icon: Icon }: Tab) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === '/' }}
      className="flex h-full flex-col items-center justify-center gap-1 text-faint data-[status=active]:text-brand"
    >
      <Icon className="size-6" strokeWidth={1.75} aria-hidden />
      <span className="text-[11px] font-medium">{label}</span>
    </Link>
  )
}
