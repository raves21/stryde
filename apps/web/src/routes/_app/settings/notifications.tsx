import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Screen } from '@/components/app/screen'
import { SectionLabel } from '@/components/app/section-label'
import { TopBar } from '@/components/app/top-bar'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { updateSettings } from '@/db/repositories/settings'
import { EnablePush } from '@/features/notifications/components/enable-push'
import { SettingRow } from '@/features/profile/components/setting-row'
import { useSettings } from '@/features/settings/use-settings'
import { OfflineState } from '@/features/social/components/offline-state'
import { useFriendActions, useFriends } from '@/features/social/use-social'
import { useOnline } from '@/lib/use-online'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/settings/notifications')({
  component: NotificationSettingsPage,
})

type Key = 'notifyFriendWorkouts' | 'notifyReactions' | 'notifyFriendRequests' | 'notifyRestTimer'

const TYPES: { key: Key; label: string; hint: string }[] = [
  {
    key: 'notifyFriendWorkouts',
    label: 'Friend workouts',
    hint: 'A friend finishes a shared workout',
  },
  { key: 'notifyReactions', label: 'Reactions', hint: 'Someone reacts to your workout' },
  { key: 'notifyFriendRequests', label: 'Friend requests', hint: 'Requests and accepted requests' },
  {
    key: 'notifyRestTimer',
    label: 'Rest timer',
    hint: 'Alert when rest ends while the app is in the background',
  },
]

const save = (patch: Parameters<typeof updateSettings>[0]) =>
  updateSettings(patch).catch((e: unknown) =>
    toast.error(e instanceof Error ? e.message : 'Could not save'),
  )

/** Settings → Notifications (UI_DESIGN.md §5.14): this device, what to be told, muted friends. */
function NotificationSettingsPage() {
  const settings = useSettings()
  const online = useOnline()
  const friends = useFriends()
  const { mute } = useFriendActions()
  const muted = friends.data?.friends.filter((f) => f.muted) ?? []
  const all = settings?.notificationsMuted ?? false

  return (
    <Screen>
      <TopBar title="Notifications" back />

      <section className="flex flex-col gap-2">
        <SectionLabel>This device</SectionLabel>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <EnablePush />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Notify me about</SectionLabel>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <SettingRow label="Mute all" hint="No pushes and no list entries" htmlFor="mute-all">
            <Switch
              id="mute-all"
              checked={all}
              onCheckedChange={(v) => void save({ notificationsMuted: v })}
            />
          </SettingRow>
          <div className={cn(all && 'opacity-50')}>
            {TYPES.map(({ key, label, hint }) => (
              <SettingRow key={key} label={label} hint={hint} htmlFor={key}>
                <Switch
                  id={key}
                  disabled={all}
                  checked={settings?.[key] ?? true}
                  onCheckedChange={(v) => void save({ [key]: v })}
                />
              </SettingRow>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Muted friends</SectionLabel>
        {!online ? (
          <OfflineState what="Your friends" />
        ) : muted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No one is muted. Mute a friend from the Friends screen to stop their workout and
            reaction notifications; they still show in your feed.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
            {muted.map((f) => (
              <li
                key={f.userId}
                className="flex min-h-14 items-center gap-3 px-4 not-last:border-b not-last:border-border"
              >
                <span className="min-w-0 flex-1 truncate">
                  {f.displayName} <span className="text-muted-foreground">@{f.username}</span>
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => mute.mutate({ userId: f.userId, muted: false })}
                >
                  Unmute
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Screen>
  )
}
