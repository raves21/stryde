import { createFileRoute } from '@tanstack/react-router'
import { ChartNoAxesColumn } from 'lucide-react'
import { EmptyState } from '@/components/app/empty-state'
import { Screen } from '@/components/app/screen'
import { TopBar } from '@/components/app/top-bar'

export const Route = createFileRoute('/_app/progress')({
  component: ProgressPage,
})

// Placeholder until Phase 5 (stats, calendar, PRs).
function ProgressPage() {
  return (
    <Screen>
      <TopBar title="Progress" />
      <EmptyState
        icon={ChartNoAxesColumn}
        title="Your stats, calendar and records will show up here once you log workouts."
      />
    </Screen>
  )
}
