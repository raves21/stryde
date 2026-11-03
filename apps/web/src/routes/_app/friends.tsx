import { createFileRoute } from '@tanstack/react-router'
import { UserPlus, UsersRound } from 'lucide-react'
import { EmptyState } from '@/components/app/empty-state'
import { Screen } from '@/components/app/screen'
import { SectionLabel } from '@/components/app/section-label'
import { TopBar } from '@/components/app/top-bar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FriendRow } from '@/features/social/components/friend-row'
import { OfflineState } from '@/features/social/components/offline-state'
import { RequestRow } from '@/features/social/components/request-row'
import { UserSearch } from '@/features/social/components/user-search'
import { useFriendRequests, useFriends } from '@/features/social/use-social'
import { useOnline } from '@/lib/use-online'

export const Route = createFileRoute('/_app/friends')({
  component: FriendsPage,
})

/** Friends and requests, add by username (UI_DESIGN.md §5.12). Online-only. */
function FriendsPage() {
  const online = useOnline()
  const friends = useFriends()
  const requests = useFriendRequests()
  const incoming = requests.data?.incoming ?? []
  const outgoing = requests.data?.outgoing ?? []

  return (
    <Screen>
      <TopBar title="Friends" back />
      {!online ? (
        <OfflineState what="Your friends" />
      ) : (
        <>
          <UserSearch />
          <Tabs defaultValue="friends" className="gap-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="friends">Friends</TabsTrigger>
              <TabsTrigger value="requests">
                Requests{incoming.length > 0 ? ` (${incoming.length})` : ''}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="friends" className="pt-2">
              {friends.data?.friends.length === 0 ? (
                <EmptyState icon={UsersRound} title="No friends yet. Add someone by username." />
              ) : (
                <ul className="flex flex-col">
                  {friends.data?.friends.map((f) => (
                    <FriendRow key={f.userId} friend={f} />
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="requests" className="flex flex-col gap-4 pt-2">
              {incoming.length === 0 && outgoing.length === 0 && (
                <EmptyState icon={UserPlus} title="No pending requests." />
              )}
              {incoming.length > 0 && (
                <section className="flex flex-col gap-1">
                  <SectionLabel>Received</SectionLabel>
                  <ul className="flex flex-col">
                    {incoming.map((r) => (
                      <RequestRow key={r.id} request={r} direction="incoming" />
                    ))}
                  </ul>
                </section>
              )}
              {outgoing.length > 0 && (
                <section className="flex flex-col gap-1">
                  <SectionLabel>Sent</SectionLabel>
                  <ul className="flex flex-col">
                    {outgoing.map((r) => (
                      <RequestRow key={r.id} request={r} direction="outgoing" />
                    ))}
                  </ul>
                </section>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </Screen>
  )
}
