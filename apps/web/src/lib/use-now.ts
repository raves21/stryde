import { useEffect, useState } from 'react'

/**
 * Current time, re-rendered every `intervalMs`. Durations are always computed from
 * timestamps against this, never accumulated.
 */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, enabled])
  return now
}
