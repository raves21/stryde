import { createFileRoute } from '@tanstack/react-router'
import { UsersRound } from 'lucide-react'
import { EmptyState } from '@/components/app/empty-state'
import { Screen } from '@/components/app/screen'
import { TopBar } from '@/components/app/top-bar'

export const Route = createFileRoute('/_app/feed')({
  component: FeedPage,
})

// v1 placeholder; the real feed arrives in Phase 8.
function FeedPage() {
  return (
    <Screen>
      <TopBar title="Feed" />
      <EmptyState icon={UsersRound} title="Friends & feed are coming soon." />
    </Screen>
  )
}
