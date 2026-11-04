// Background rest-timer alert (plan/phase-09 §5): while a timer runs the server is told when
// it ends, so a locked phone still gets a push. Online-only and best effort; the in-app timer
// is what the workout relies on.

/** Schedule (`endsAt`) or cancel (`null`) the push for this workout's rest timer. */
export async function syncRestPush(sessionId: string, endsAt: string | null): Promise<void> {
  if (!navigator.onLine || !('Notification' in window) || Notification.permission !== 'granted') {
    return
  }
  try {
    await fetch('/api/rest-timer', {
      method: endsAt ? 'POST' : 'DELETE',
      credentials: 'same-origin',
      headers: endsAt ? { 'Content-Type': 'application/json' } : undefined,
      body: endsAt ? JSON.stringify({ sessionId, fireAt: endsAt }) : undefined,
    })
  } catch {
    // Offline or the server is down: the in-app timer still alerts.
  }
}
