/** `YYYY-MM-DD` of `date` in `timeZone` (a session's calendar day). */
export function localDateIn(date: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Weeks start on Sunday everywhere (calendar, year grid, week strip, weekly stats). */
export const WEEK_STARTS_ON = 0 as const

const INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** Weekday initials in display order, starting from `WEEK_STARTS_ON`, plus each one's day (0 = Sunday). */
export function weekdayInitials(): { letter: string; day: number }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = (WEEK_STARTS_ON + i) % 7
    return { letter: INITIALS[day] ?? '', day }
  })
}
