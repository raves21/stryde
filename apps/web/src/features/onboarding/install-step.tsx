import { Share, SquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Placeholder until Phase 6 adds the real install flow (beforeinstallprompt, detection).
export function InstallStep({ onDone }: { onDone: () => void }) {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[28px] font-semibold leading-tight">Install the app</h1>
        <p className="text-muted-foreground">
          Add Stryde to your home screen so it opens full screen and works offline at the gym.
        </p>
      </div>
      <ol className="flex flex-col gap-3 rounded-xl bg-surface p-4">
        {isIos ? (
          <>
            <li className="flex items-center gap-3">
              <Share className="size-5 text-muted-foreground" aria-hidden /> Tap Share in Safari
            </li>
            <li className="flex items-center gap-3">
              <SquarePlus className="size-5 text-muted-foreground" aria-hidden /> Choose “Add to
              Home Screen”
            </li>
          </>
        ) : (
          <li>Open your browser menu and choose “Install app”.</li>
        )}
      </ol>
      <Button size="lg" onClick={onDone}>
        Done
      </Button>
    </div>
  )
}
