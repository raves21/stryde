import { useEffect, useRef, useState } from 'react'

const TRIGGER_PX = 70
const MAX_PX = 100

/**
 * Pull down from the top of the page to refresh (UI_DESIGN.md §5.11). Returns how far
 * the user has pulled (for an indicator). Doesn't block native scrolling.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown>, enabled = true) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const latest = useRef(onRefresh)
  latest.current = onRefresh

  useEffect(() => {
    if (!enabled) return
    let distance = 0
    const onStart = (e: TouchEvent) => {
      startY.current = window.scrollY <= 0 ? (e.touches[0]?.clientY ?? null) : null
    }
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return
      distance = Math.max(0, (e.touches[0]?.clientY ?? 0) - startY.current)
      if (window.scrollY > 0) distance = 0
      setPull(Math.min(distance, MAX_PX))
    }
    const onEnd = async () => {
      const triggered = startY.current !== null && distance >= TRIGGER_PX
      startY.current = null
      distance = 0
      setPull(0)
      if (!triggered) return
      setRefreshing(true)
      try {
        await latest.current()
      } finally {
        setRefreshing(false)
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [enabled])

  return { pull, refreshing }
}
