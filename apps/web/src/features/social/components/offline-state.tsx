import { CloudOff } from 'lucide-react'
import { EmptyState } from '@/components/app/empty-state'

/** Social screens aren't cached: offline they show this and reload on reconnect (§5.11). */
export function OfflineState({ what = 'The feed' }: { what?: string }) {
  return (
    <EmptyState
      icon={CloudOff}
      title={`You're offline. ${what} will load when you're back online.`}
    />
  )
}
