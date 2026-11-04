import { Button } from '@/components/ui/button'
import { EnablePush } from '@/features/notifications/components/enable-push'

/** Onboarding step 4 (UI_DESIGN.md §5.2): opt in to notifications, or skip. */
export function NotificationsStep({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[28px] font-semibold leading-tight">Notifications</h1>
        <p className="text-muted-foreground">
          Hear when friends finish a workout or react to yours, and get an alert when your rest
          timer ends with the phone locked. You can change this any time in Settings.
        </p>
      </div>
      <EnablePush onEnabled={onDone} />
      <Button size="lg" variant="secondary" onClick={onDone}>
        Not now
      </Button>
    </div>
  )
}
