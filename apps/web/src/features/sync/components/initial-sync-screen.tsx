import { LoaderCircle } from 'lucide-react'

/** First sync on a new device (cursor 0), shown until the first pull completes. */
export function InitialSyncScreen() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <LoaderCircle className="size-8 animate-spin text-brand" aria-hidden />
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[28px] font-semibold leading-tight">
          Downloading your data
        </h1>
        <p className="text-muted-foreground">This only happens once on this device.</p>
      </div>
    </main>
  )
}
