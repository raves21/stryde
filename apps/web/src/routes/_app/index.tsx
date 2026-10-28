import { createFileRoute, Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Screen } from '@/components/app/screen'
import { SectionLabel } from '@/components/app/section-label'
import { TopBar } from '@/components/app/top-bar'
import { Button } from '@/components/ui/button'
import { SessionListItem } from '@/features/progress/components/session-list-item'
import { WeekStrip } from '@/features/progress/components/week-strip'
import { useTraining } from '@/features/progress/use-training'
import { TemplateStrip } from '@/features/templates/components/template-strip'
import { StartCard } from '@/features/workout/components/start-card'

export const Route = createFileRoute('/_app/')({
  component: Home,
})

// Today (UI_DESIGN.md §5.3): greeting, week strip, start/resume, templates, recent workouts.
function Home() {
  const { user } = Route.useRouteContext()
  const firstName = user?.user.displayName.split(/\s+/)[0]
  const training = useTraining()

  return (
    <Screen>
      <TopBar title="Today" />
      <p className="-mt-4 text-muted-foreground">
        Hi {firstName} · {format(new Date(), 'EEEE, d MMMM')}
      </p>
      {training && <WeekStrip trained={training.trainedDates} />}
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
        <TemplateStrip lastDone={training?.lastDoneByTemplate} />
      </section>
      {training && (
        <section className="flex flex-col gap-3">
          <SectionLabel
            action={
              training.sessions.length > 0 && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto px-0 text-muted-foreground"
                  asChild
                >
                  <Link to="/history">See all</Link>
                </Button>
              )
            }
          >
            Recent workouts
          </SectionLabel>
          {training.sessions.length === 0 ? (
            <p className="text-muted-foreground">
              No workouts yet. Your first one sets the baseline.
            </p>
          ) : (
            training.sessions
              .slice(0, 3)
              .map((s) => <SessionListItem key={s.session.id} summary={s} />)
          )}
        </section>
      )}
    </Screen>
  )
}
