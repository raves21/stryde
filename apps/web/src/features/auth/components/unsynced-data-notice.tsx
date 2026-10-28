import { CloudOff } from 'lucide-react'
import { useUnsyncedOwner } from '../use-unsynced-owner'

/** Warns before a different user signs in and the local DB (with its outbox) is cleared. */
export function UnsyncedDataNotice() {
  const owner = useUnsyncedOwner()
  if (!owner) return null
  const who = owner.username ? `@${owner.username}` : 'the previous account'
  const n = owner.pending === 1 ? '1 change' : `${owner.pending} changes`
  return (
    <div className="flex gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-warning">
      <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        This device has {n} from {who} that haven't synced. Sign in as {who} to keep them; signing
        in as someone else deletes them.
      </span>
    </div>
  )
}
