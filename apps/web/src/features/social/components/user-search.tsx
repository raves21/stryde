import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { UserAvatar } from '@/components/app/user-avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useFriendActions, useUserSearch } from '../use-social'

/** "Add by username": prefix search with an Add button per result (UI_DESIGN.md §5.12). */
export function UserSearch() {
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim().replace(/^@/, '')), 300)
    return () => clearTimeout(t)
  }, [text])
  const { data, isFetching } = useUserSearch(query)
  const { sendRequest } = useFriendActions()

  return (
    <section className="flex flex-col gap-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-faint"
          aria-hidden
        />
        <Input
          type="search"
          aria-label="Add by username"
          placeholder="Add by username"
          autoCapitalize="none"
          autoCorrect="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="pl-10"
        />
      </div>
      {query && data && (
        <ul className="flex flex-col">
          {data.users.length === 0 && !isFetching && (
            <li className="py-3 text-sm text-muted-foreground">No one with that username.</li>
          )}
          {data.users.map((u) => (
            <li key={u.username} className="flex min-h-16 items-center gap-3">
              <UserAvatar displayName={u.displayName} avatarUrl={u.avatarUrl} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{u.displayName}</span>
                <span className="truncate text-sm text-muted-foreground">@{u.username}</span>
              </div>
              {u.relation === 'none' || u.relation === 'incoming' ? (
                <Button
                  size="sm"
                  disabled={sendRequest.isPending}
                  onClick={() => sendRequest.mutate(u.username)}
                  aria-label={`${u.relation === 'incoming' ? 'Accept' : 'Add'} ${u.displayName}`}
                >
                  {u.relation === 'incoming' ? 'Accept' : 'Add'}
                </Button>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {u.relation === 'friend' ? 'Friends' : 'Requested'}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
