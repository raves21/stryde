import { createFileRoute } from '@tanstack/react-router'
import { Screen } from '@/components/app/screen'
import { TopBar } from '@/components/app/top-bar'
import { InstallGuide } from '@/features/pwa/components/install-guide'

export const Route = createFileRoute('/_app/settings/install')({
  component: InstallPage,
})

function InstallPage() {
  return (
    <Screen>
      <TopBar title="Install app" back />
      <p className="-mt-2 text-muted-foreground">
        Installed, Stryde opens full screen, starts without a connection and keeps your workouts on
        this device.
      </p>
      <InstallGuide />
    </Screen>
  )
}
