import { expect, type Page, test } from '@playwright/test'

// PRODUCT_SPEC.md §4.3 / plan/phase-04: start from a template, log sets including a
// failure set (reps must be typed), finish, and see it on the server; then the same
// with the device offline, syncing after reconnect.

async function signUp(page: Page) {
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

/** "Bench": set 1 fixed 5 reps @ 60 kg, set 2 to failure. */
async function createTemplate(page: Page, name: string) {
  await page.getByRole('link', { name: 'New template' }).click()
  await page.getByLabel('Template name').fill(name)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  const picker = page.getByRole('dialog')
  await picker.getByLabel('Search exercises').fill('Bench Press')
  await picker.getByRole('button', { name: /^Bench Press Barbell/ }).click()
  await expect(picker).toBeHidden()
  await page.getByLabel('Set 1 target reps').fill('5')
  await page.getByLabel('Set 1 planned weight in kg').fill('60')
  await page.getByRole('button', { name: 'Add set' }).click()
  await page.getByRole('button', { name: 'Set 2 options' }).click()
  await page.getByRole('dialog').getByRole('radio', { name: 'Failure' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByText('Saved')).toBeVisible()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Today' }).click()
}

async function startFromTemplate(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Start' }).click()
  await expect(page.getByLabel('Workout name')).toHaveValue(name)
}

/** Log both sets; the failure set needs typed reps before ✓ unlocks. */
async function logSets(page: Page) {
  const set1 = page.getByRole('group', { name: 'Set 1' })
  await expect(set1.getByLabel('Set 1 weight in kg')).toHaveValue('60')
  await expect(set1.getByLabel('Set 1 reps')).toHaveValue('5')
  await set1.getByRole('button', { name: 'Complete set 1' }).click()
  await expect(page.getByRole('timer', { name: 'Rest timer' })).toBeVisible()

  const set2 = page.getByRole('group', { name: 'Set 2' })
  const check = set2.getByRole('button', { name: 'Complete set 2' })
  await expect(check).toBeDisabled()
  // ≤ 2 taps + typing: tap reps, type, tap ✓.
  await set2.getByLabel('Set 2 reps').click()
  await page.keyboard.type('7')
  await check.click()
  await expect(set2.getByRole('button', { name: 'Set 2 completed' })).toBeVisible()
}

async function finish(page: Page) {
  await page.getByRole('button', { name: 'Finish' }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByText('Exercises')).toBeVisible()
  await sheet.getByRole('button', { name: 'Save workout' }).click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
}

type Pulled = { changes: { table: string; row: Record<string, unknown> }[] }

/** The user's finished sessions on the server, each with its completed sets. */
async function serverWorkouts(page: Page) {
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

test('log a workout from a template, then again fully offline', async ({ page, context }) => {
  await signUp(page)
  await createTemplate(page, 'Push Day')

  // Online run, with a reload mid-workout: everything resumes, including the rest timer.
  await startFromTemplate(page, 'Push Day')
  await page
    .getByRole('group', { name: 'Set 1' })
    .getByRole('button', { name: 'Complete set 1' })
    .click()
  await expect(page.getByRole('timer', { name: 'Rest timer' })).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('group', { name: 'Set 1' }).getByRole('button', { name: 'Set 1 completed' }),
  ).toBeVisible()
  await expect(page.getByRole('timer', { name: 'Rest timer' })).toBeVisible()
  await page
    .getByRole('group', { name: 'Set 1' })
    .getByRole('button', { name: 'Set 1 completed' })
    .click()
  await logSets(page)
  await finish(page)
  await expect
    .poll(() => serverWorkouts(page))
    .toEqual([
      {
        name: 'Push Day',
        sets: [
          [60, 5, null, 'fixed'],
          [60, 7, 0, 'failure'],
        ],
      },
    ])

  // Airplane mode: start, log and finish without a network. The app code is already
  // loaded (no service worker until Phase 6).
  await context.setOffline(true)
  await startFromTemplate(page, 'Push Day')
  // Pre-filled from last time: the failure set's weight came from the previous workout.
  await expect(
    page
      .getByRole('group', { name: 'Set 2' })
      .getByRole('button', { name: /Copy previous: 60×7 F/ }),
  ).toBeVisible()
  await logSets(page)
  await finish(page)
  await expect(page.getByRole('button', { name: /Offline, \d+ changes? pending/ })).toBeVisible()

  await context.setOffline(false)
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 20_000 })
  await expect.poll(() => serverWorkouts(page)).toHaveLength(2)
})
