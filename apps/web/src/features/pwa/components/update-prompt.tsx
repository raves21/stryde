import { useRegisterSW } from 'virtual:pwa-register/react'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { useActiveSession } from '@/features/workout/use-workout'

const HOUR = 60 * 60 * 1000

/**
 * "Update available — Reload" once a new service worker is waiting. Never during an
 * active workout (AGENTS.md hard rule 11): the toast waits until it's finished or
 * discarded, and is withdrawn if one starts.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), HOUR)
    },
  })
  const active = useActiveSession()

  useEffect(() => {
    // `undefined` = still loading: wait for a definite "no workout".
    if (!needRefresh || active !== null) return
    const id = toast('Update available', {
      duration: Number.POSITIVE_INFINITY,
      action: { label: 'Reload', onClick: () => void updateServiceWorker(true) },
    })
    return () => {
      toast.dismiss(id)
    }
  }, [needRefresh, active, updateServiceWorker])

  return null
}
