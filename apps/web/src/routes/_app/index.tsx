import { createFileRoute, Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Screen } from '@/components/app/screen'
import { SectionLabel } from '@/components/app/section-label'
import { TopBar } from '@/components/app/top-bar'
import { Button } from '@/components/ui/button'
import { TemplateStrip } from '@/features/templates/components/template-strip'
import { StartCard } from '@/features/workout/components/start-card'

export const Route = createFileRoute('/_app/')({
  component: Home,
})

// Today: greeting, start/resume, templates. Week strip and recent workouts arrive with
// history (Phase 5).
function Home() {
  const { user } = Route.useRouteContext()
  const firstName = user?.user.displayName.split(/\s+/)[0]

  return (
    <Screen>
      <TopBar title="Today" />
      <p className="-mt-4 text-muted-foreground">
        Hi {firstName} · {format(new Date(), 'EEEE, d MMMM')}
      </p>
      <StartCard />
      <section className="flex flex-col gap-3">
        <SectionLabel
          action={
            <Button variant="link" size="sm" className="h-auto px-0 text-muted-foreground" asChild>
              <Link to="/templates">See all</Link>
            </Button>
          }
        >
          Templates
        </SectionLabel>
        <TemplateStrip />
      </section>
    </Screen>
  )
}
