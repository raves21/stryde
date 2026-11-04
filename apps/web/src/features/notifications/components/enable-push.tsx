import { Link } from '@tanstack/react-router'
import { BellRing } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useOnline } from '@/lib/use-online'
import { disablePush, type EnableResult, enablePush } from '../push'
import { usePushState } from '../use-push-state'

const MESSAGES: Record<Exclude<EnableResult, 'enabled'>, string> = {
  denied: 'Notifications are blocked. Allow them for Stryde in your browser or phone settings.',
  unsupported: "This browser can't receive push notifications.",
  'not-configured': 'Notifications are not set up on this server yet.',
  offline: 'You need a connection to turn notifications on.',
  failed: "Couldn't turn notifications on. Try again.",
}

/**
 * Enable / disable push on this device. The permission prompt is requested from the click
 * handler (iOS requires a user gesture); on iOS outside the installed app it explains how
 * to install first instead.
 */
export function EnablePush({ onEnabled }: { onEnabled?: () => void }) {
  const { support, permission, subscribed, refresh } = usePushState()
  const online = useOnline()
  const [busy, setBusy] = useState(false)

  if (support === 'ios-needs-install') {
    return (
      <div className="flex flex-col gap-3 text-sm text-muted-foreground">
        <p>
          On iPhone, notifications work once Stryde is added to your Home Screen. Open it from the
          Home Screen icon, then come back here.
        </p>
        <Button asChild variant="secondary">
          <Link to="/settings/install">How to install</Link>
        </Button>
      </div>
    )
  }
  if (support === 'unsupported') {
    return <p className="text-sm text-muted-foreground">{MESSAGES.unsupported}</p>
  }
  if (permission === 'denied') {
    return <p className="text-sm text-muted-foreground">{MESSAGES.denied}</p>
  }

  async function turnOn() {
    setBusy(true)
    const result = await enablePush()
    await refresh()
    setBusy(false)
    if (result === 'enabled') {
      toast('Notifications are on')
      onEnabled?.()
    } else {
      toast.error(MESSAGES[result])
    }
  }

  async function turnOff() {
    setBusy(true)
    await disablePush()
    await refresh()
    setBusy(false)
    toast('Notifications are off on this device')
  }

  if (subscribed) {
    return (
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm text-muted-foreground">On for this device.</p>
        <Button variant="secondary" size="sm" onClick={turnOff} disabled={busy || !online}>
          Turn off
        </Button>
      </div>
    )
  }
  return (
    <Button size="lg" onClick={turnOn} disabled={busy || !online}>
      <BellRing /> Enable notifications
    </Button>
  )
}
