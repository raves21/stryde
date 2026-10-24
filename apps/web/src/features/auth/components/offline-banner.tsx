import { CloudOff } from 'lucide-react'

export function OfflineBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-warning">
      <CloudOff className="size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  )
}
