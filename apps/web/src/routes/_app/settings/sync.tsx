import { createFileRoute } from '@tanstack/react-router'
import { format, formatDistanceToNow } from 'date-fns'
import { CircleAlert, CircleCheck, CloudOff, LoaderCircle, RefreshCw, X } from 'lucide-react'
import { Screen } from '@/components/app/screen'
import { SectionLabel } from '@/components/app/section-label'
import { TopBar } from '@/components/app/top-bar'
import { Button } from '@/components/ui/button'
import { useOnline } from '@/lib/use-online'
import { requestSync } from '@/sync/controller'
import { dismissSyncError, usePendingCount, useSyncErrors } from '@/sync/hooks'
import { useSyncState } from '@/sync/status'

export const Route = createFileRoute('/_app/settings/sync')({
  component: SyncSettingsPage,
})

/** Settings → Sync & data (plan/phase-06 §5): status, last sync, pending, Sync now, errors. */
function SyncSettingsPage() {
  const { status, lastSyncAt, error } = useSyncState()
  const online = useOnline()
  const pending = usePendingCount()
  const errors = useSyncErrors()
  const state = online ? status : 'offline'

  const {
    icon: Icon,
    text,
    tone,
  } = {
    idle: {
      icon: CircleCheck,
      text: pending ? 'Waiting to sync' : 'Everything is synced',
      tone: 'text-success',
    },
    syncing: { icon: LoaderCircle, text: 'Syncing…', tone: 'text-muted-foreground animate-spin' },
    offline: {
      icon: CloudOff,
      text: 'Offline: changes are saved on this device',
      tone: 'text-warning',
    },
    error: {
      icon: CircleAlert,
      text: `Sync failed${error ? `: ${error}` : ''}`,
      tone: 'text-failure',
    },
  }[state]

  return (
    <Screen>
      <TopBar title="Sync" back />
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
        <p className="flex items-center gap-3 font-medium">
          <Icon className={`size-5 shrink-0 ${tone}`} aria-hidden />
          {text}
        </p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Last synced</dt>
            <dd className="tnum">
              {lastSyncAt ? formatDistanceToNow(lastSyncAt, { addSuffix: true }) : 'Never'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pending changes</dt>
            <dd className="tnum">{pending}</dd>
          </div>
        </dl>
        <Button onClick={requestSync} disabled={!online || state === 'syncing'}>
          <RefreshCw /> Sync now
        </Button>
      </section>

      {errors.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Rejected changes</SectionLabel>
          <p className="text-sm text-muted-foreground">
            The server refused these. They stay on this device only; dismiss them once you've
            checked.
          </p>
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
            {errors.map((e) => (
              <li
                key={e.id}
                className="flex items-start gap-3 border-border px-4 py-3 not-last:border-b"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-failure" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col text-sm">
                  <span className="font-medium">
                    {e.table} · <span className="font-mono text-xs">{e.rowId.slice(0, 8)}</span>
                  </span>
                  <span className="break-words text-muted-foreground">{e.error}</span>
                  <span className="text-xs text-muted-foreground">{format(e.at, 'd MMM, p')}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Dismiss"
                  onClick={() => void dismissSyncError(e.id)}
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Screen>
  )
}
