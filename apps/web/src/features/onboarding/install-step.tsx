import { Button } from '@/components/ui/button'
import { InstallGuide } from '@/features/pwa/components/install-guide'

export function InstallStep({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[28px] font-semibold leading-tight">Install the app</h1>
        <p className="text-muted-foreground">
          Add Stryde to your home screen so it opens full screen and works offline at the gym.
        </p>
      </div>
      <InstallGuide />
      <Button size="lg" variant="secondary" onClick={onDone}>
        Done
      </Button>
    </div>
  )
}
