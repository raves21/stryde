// When a downloaded app update may be applied without asking. Applying means reloading the
// page, so it only happens when nobody would notice or lose anything (AGENTS.md hard rule 11:
// never during a workout).

/** Coming back after at least this long counts as a fresh start for the update. */
export const RESUME_AFTER_MS = 5 * 60_000

/**
 * Wait this long after the app goes to the background before activating the update. Asking
 * the waiting service worker to take over in the very moment the app is hidden (while the
 * app is also closing its live connection and pausing timers) often left it pending forever
 * in Chromium; a short pause makes it reliable (verified in a real browser).
 */
export const APPLY_DELAY_MS = 1500

/** Screens where typing would be lost on reload: sign-in, sign-up and onboarding. */
const UNSAFE_PATHS = ['/login', '/signup', '/onboarding']

export type UpdateContext = {
  /** A new version is downloaded and waiting. */
  waiting: boolean
  /** `undefined` while it is still loading: treated as "maybe", so no update. */
  workoutActive: boolean | undefined
  /** Something on screen holds edits that aren't saved yet (see `useUnsavedWork`). */
  unsavedWork: boolean
  pathname: string
  /** The app is in the background right now. */
  hidden: boolean
  /** How long it was in the background, when it has just come back. */
  hiddenForMs: number
}

export function shouldApplyUpdate(c: UpdateContext): boolean {
  if (!c.waiting || c.workoutActive !== false || c.unsavedWork) return false
  if (UNSAFE_PATHS.some((p) => c.pathname === p || c.pathname.startsWith(`${p}/`))) return false
  // In the background: reload now, the user returns to the new version. Visible: only right
  // after a longer absence, when the app is starting over from the user's point of view.
  return c.hidden || c.hiddenForMs >= RESUME_AFTER_MS
}
