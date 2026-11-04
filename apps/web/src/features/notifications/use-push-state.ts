import { useCallback, useEffect, useState } from 'react'
import { currentSubscription, notificationPermission, type PushSupport, pushSupport } from './push'

export type PushState = {
  support: PushSupport
  permission: NotificationPermission | 'unsupported'
  /** Whether this browser has a push subscription (null while checking). */
  subscribed: boolean | null
}

/** This device's notification state, re-read when the tab regains focus. */
export function usePushState() {
  const [state, setState] = useState<PushState>(() => ({
    support: pushSupport(),
    permission: notificationPermission(),
    subscribed: null,
  }))

  const refresh = useCallback(async () => {
    const subscription = pushSupport() === 'supported' ? await currentSubscription() : null
    setState({
      support: pushSupport(),
      permission: notificationPermission(),
      subscribed: subscription !== null,
    })
  }, [])

  useEffect(() => {
    void refresh()
    const onFocus = () => void refresh()
    document.addEventListener('visibilitychange', onFocus)
    return () => document.removeEventListener('visibilitychange', onFocus)
  }, [refresh])

  return { ...state, refresh }
}
