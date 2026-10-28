import { formatDistanceToNow } from 'date-fns'
import { CircleAlert, CloudOff, LoaderCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { useOnline } from '@/lib/use-online'
import { requestSync } from '@/sync/controller'
import { usePendingCount, useSyncErrorCount } from '@/sync/hooks'
import { useSyncState } from '@/sync/status'

const changes = (n: number) => `${n} ${n === 1 ? 'change' : 'changes'}`

/** Top-bar sync state (UI_DESIGN.md §3); tap for details. */
export function SyncIndicator() {
  const { status, lastSyncAt, error } = useSyncState()
  const pending = usePendingCount()
  const rejected = useSyncErrorCount()
  const online = useOnline()
  const state = online ? status : 'offline'

  const label = {
    idle: pending > 0 ? `${changes(pending)} waiting to sync` : 'Synced',
    syncing: 'Syncing',
    offline: pending > 0 ? `Offline, ${changes(pending)} pending` : 'Offline',
    error: 'Sync error',
  }[state]

  const description = {
    idle:
      pending > 0
        ? `${changes(pending)} saved on this device, syncing shortly.`
        : 'Everything on this device is synced.',
    syncing: pending > 0 ? `Syncing ${changes(pending)}…` : 'Checking for changes…',
    offline:
      pending > 0
        ? `You're offline. ${changes(pending)} saved on this device and will sync automatically.`
        : "You're offline. Anything you log is saved on this device and syncs automatically.",
    error: `Sync failed${error ? `: ${error}` : ''}. Your changes are safe on this device.`,
  }[state]

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label}>
          {state === 'idle' && <span className="size-2.5 rounded-full bg-success" aria-hidden />}
          {state === 'syncing' && (
            <LoaderCircle className="size-5 animate-spin text-muted-foreground" aria-hidden />
          )}
          {state === 'offline' && (
            <span className="flex items-center gap-1 text-warning">
              <CloudOff className="size-5" aria-hidden />
              {pending > 0 && (
                <Badge variant="secondary" className="tnum px-1.5">
                  {pending}
                </Badge>
              )}
            </span>
          )}
          {state === 'error' && <CircleAlert className="size-5 text-failure" aria-hidden />}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{label}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
          {rejected > 0 && (
            <p className="text-sm text-failure">
              The server rejected {changes(rejected)}. They stay on this device only.
            </p>
          )}
          {lastSyncAt && (
            <p className="text-sm text-faint">
              Last synced {formatDistanceToNow(lastSyncAt, { addSuffix: true })}
            </p>
          )}
        </DrawerHeader>
        {state === 'error' && (
          <DrawerFooter>
            <Button onClick={requestSync}>Retry</Button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  )
}
