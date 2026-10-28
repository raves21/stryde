import { expect, type Page } from '@playwright/test'

export async function signUp(page: Page) {
  const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
  await page.goto('/signup')
  await page.getByLabel('Display name').fill('Juan Dela Cruz')
  await page.getByLabel('Username').fill(`e2e_${id}`)
  await page.getByLabel('Email').fill(`e2e_${id}@example.com`)
  await page.getByLabel('Password').fill('correct-horse-battery')
  // Enabled once the live username check passes.
  const create = page.getByRole('button', { name: 'Create account' })
  await expect(create).toBeEnabled()
  await create.click()
  await page.getByRole('heading', { name: 'Units' }).waitFor()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
}

type Pulled = { changes: { table: string; row: Record<string, unknown> }[] }

/** The user's finished sessions on the server, each with its completed sets. */
export async function serverWorkouts(page: Page) {
  const res = await page.request.get('/api/sync/pull?cursor=0')
  expect(res.ok()).toBe(true)
  const { changes } = (await res.json()) as Pulled
  const rows = (t: string) => changes.filter((c) => c.table === t).map((c) => c.row)
  return rows('sessions')
    .filter((s) => s.finishedAt && !s.deletedAt)
    .map((s) => {
      const ses = rows('sessionExercises').filter((se) => se.sessionId === s.id && !se.deletedAt)
      const sets = rows('sets').filter(
        (x) => ses.some((se) => se.id === x.sessionExerciseId) && !x.deletedAt && x.completedAt,
      )
      return { name: s.name, sets: sets.map((x) => [x.weightKg, x.reps, x.rir, x.targetKind]) }
    })
}
