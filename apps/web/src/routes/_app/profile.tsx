import { createFileRoute } from '@tanstack/react-router'
import { format, formatDistanceToNow } from 'date-fns'
import { Download, Dumbbell, LayoutList, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Screen } from '@/components/app/screen'
import { SectionLabel } from '@/components/app/section-label'
import { TopBar } from '@/components/app/top-bar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { updateSettings } from '@/db/repositories/settings'
import { SignOutButton } from '@/features/auth/components/sign-out-button'
import { formatDuration, REST_OPTIONS } from '@/features/exercises/labels'
import { NavRow } from '@/features/profile/components/nav-row'
import { SettingRow } from '@/features/profile/components/setting-row'
import { useTraining } from '@/features/progress/use-training'
import { useInstallPrompt } from '@/features/pwa/install'
import { useSettings, useUnit } from '@/features/settings/use-settings'
import { setKeepScreenOn, useKeepScreenOn } from '@/features/workout/use-workout'
import { useOnline } from '@/lib/use-online'
import { usePendingCount } from '@/sync/hooks'
import { useSyncState } from '@/sync/status'

export const Route = createFileRoute('/_app/profile')({
  component: ProfilePage,
})

const save = (patch: Parameters<typeof updateSettings>[0]) =>
  updateSettings(patch).catch((e: unknown) =>
    toast.error(e instanceof Error ? e.message : 'Could not save'),
  )

/** Profile & settings hub (UI_DESIGN.md §5.14). Notifications arrive in v2. */
function ProfilePage() {
  const { user } = Route.useRouteContext()
  const settings = useSettings()
  const unit = useUnit()
  const keepScreenOn = useKeepScreenOn()
  const training = useTraining()
  const pending = usePendingCount()
  const { status, lastSyncAt } = useSyncState()
  const online = useOnline()
  const { standalone } = useInstallPrompt()
  if (!user) return null
  const { displayName, username, avatarUrl, createdAt } = user.user
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const workouts = training?.sessions.length ?? 0
  const syncDetail = !online
    ? `Offline${pending ? ` · ${pending} pending` : ''}`
    : status === 'error'
      ? 'Error'
      : pending
        ? `${pending} pending`
        : lastSyncAt
          ? `Synced ${formatDistanceToNow(lastSyncAt, { addSuffix: true })}`
          : 'Not synced yet'

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
          <p className="tnum text-sm text-muted-foreground">
            {workouts} {workouts === 1 ? 'workout' : 'workouts'} · Member since{' '}
            {format(createdAt, 'MMM yyyy')}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Library</SectionLabel>
        <nav className="overflow-hidden rounded-2xl border border-border bg-surface">
          <NavRow to="/templates" icon={LayoutList} label="Templates" />
          <NavRow to="/exercises" icon={Dumbbell} label="Exercises" />
        </nav>
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Workout</SectionLabel>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <SettingRow label="Units">
            <ToggleGroup
              type="single"
              value={unit}
              onValueChange={(v) => (v === 'kg' || v === 'lb') && void save({ unit: v })}
              spacing={1}
              aria-label="Units"
            >
              {(['kg', 'lb'] as const).map((u) => (
                <ToggleGroupItem
                  key={u}
                  value={u}
                  className="h-10 w-14 bg-surface-2 font-display text-lg font-bold uppercase data-[state=on]:bg-brand-dim data-[state=on]:text-brand"
                >
                  {u}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </SettingRow>
          <SettingRow label="Default rest" htmlFor="default-rest">
            <Select
              value={String(settings?.defaultRestSeconds ?? 120)}
              onValueChange={(v) => void save({ defaultRestSeconds: Number(v) })}
            >
              <SelectTrigger id="default-rest" className="tnum w-24 data-[size=default]:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REST_OPTIONS.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {formatDuration(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow
            label="Keep screen on"
            hint="During workouts, on this device"
            htmlFor="keep-screen-on"
          >
            <Switch
              id="keep-screen-on"
              checked={keepScreenOn}
              onCheckedChange={(v) => void setKeepScreenOn(v)}
            />
          </SettingRow>
          <SettingRow
            label="Share new workouts"
            hint="Default for “Share with friends”"
            htmlFor="share-default"
          >
            <Switch
              id="share-default"
              checked={settings?.defaultShareWithFriends ?? true}
              onCheckedChange={(v) => void save({ defaultShareWithFriends: v })}
            />
          </SettingRow>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Sync & data</SectionLabel>
        <nav className="overflow-hidden rounded-2xl border border-border bg-surface">
          <NavRow to="/settings/sync" icon={RefreshCw} label="Sync" detail={syncDetail} />
        </nav>
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>App</SectionLabel>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <NavRow
            to="/settings/install"
            icon={Download}
            label="Install app"
            detail={standalone ? 'Installed' : undefined}
          />
          <SettingRow label="Version">
            <span className="tnum font-mono text-sm text-muted-foreground">{__APP_VERSION__}</span>
          </SettingRow>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Account</SectionLabel>
        <SignOutButton />
      </section>
    </Screen>
  )
}
