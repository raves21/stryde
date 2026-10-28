import { createFileRoute } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Dumbbell, LayoutList } from 'lucide-react'
import { Screen } from '@/components/app/screen'
import { SectionLabel } from '@/components/app/section-label'
import { TopBar } from '@/components/app/top-bar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SignOutButton } from '@/features/auth/components/sign-out-button'
import { NavRow } from '@/features/profile/components/nav-row'

export const Route = createFileRoute('/_app/profile')({
  component: ProfilePage,
})

// Profile header + library links; the settings groups arrive in Phase 6.
function ProfilePage() {
  const { user } = Route.useRouteContext()
  if (!user) return null
  const { displayName, username, avatarUrl, createdAt } = user.user
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <Screen>
      <TopBar title="Profile" />
      <section className="flex items-center gap-4">
        <Avatar className="size-16">
          {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
          <AvatarFallback className="bg-surface-3 text-lg font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-xl font-semibold">{displayName}</p>
          {username && <p className="text-muted-foreground">@{username}</p>}
          <p className="text-sm text-faint">Member since {format(createdAt, 'MMM yyyy')}</p>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Library</SectionLabel>
        <nav className="overflow-hidden rounded-2xl border border-border bg-surface">
          <NavRow to="/templates" icon={LayoutList} label="Templates" />
          <NavRow to="/exercises" icon={Dumbbell} label="Exercises" />
        </nav>
      </section>

      <SignOutButton />
    </Screen>
  )
}
