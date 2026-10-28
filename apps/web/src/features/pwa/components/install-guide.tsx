import { CircleCheck, Download, EllipsisVertical, Share, SquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { platform, useInstallPrompt } from '../install'

/**
 * How to install: one-tap on Chromium (`beforeinstallprompt`), step by step on iOS
 * Safari, the browser menu otherwise (UI_DESIGN.md §5.2).
 */
export function InstallGuide() {
  const { canPrompt, standalone, prompt } = useInstallPrompt()
  const os = platform()

  if (standalone) {
    return (
      <p className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
        <CircleCheck className="size-5 shrink-0 text-success" aria-hidden />
        Stryde is installed on this device.
      </p>
    )
  }
  if (canPrompt) {
    return (
      <Button size="lg" onClick={() => void prompt()}>
        <Download /> Install Stryde
      </Button>
    )
  }
  const steps =
    os === 'ios'
      ? [
          { icon: Share, text: 'Tap the Share button in Safari’s toolbar' },
          { icon: SquarePlus, text: 'Scroll down and choose “Add to Home Screen”' },
          { icon: CircleCheck, text: 'Tap “Add”, then open Stryde from your home screen' },
        ]
      : [
          { icon: EllipsisVertical, text: 'Open your browser’s menu' },
          { icon: SquarePlus, text: 'Choose “Install app” or “Add to Home screen”' },
          { icon: CircleCheck, text: 'Open Stryde from your home screen' },
        ]
  return (
    <ol className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-2">
      {steps.map(({ icon: Icon, text }, i) => (
        <li key={text} className="flex items-center gap-3 rounded-lg p-2">
          <span className="tnum flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-3 font-display font-bold">
            {i + 1}
          </span>
          <span className="flex-1">{text}</span>
          <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </li>
      ))}
      {os === 'ios' && (
        <li className="p-2 text-sm text-muted-foreground">
          On iPhone this only works in Safari. Notifications (coming later) need the installed app.
        </li>
      )}
    </ol>
  )
}
