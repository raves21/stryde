import { Link } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUnreadCount } from '../use-notifications'

/** Bell with an unread dot, left of the sync indicator in the top bar. */
export function NotificationBell() {
  const unread = useUnreadCount()
  return (
    <Button variant="ghost" size="icon" asChild className="relative">
      <Link
        to="/notifications"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-brand" aria-hidden />
        )}
      </Link>
    </Button>
  )
}
