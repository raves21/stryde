import { expect, test } from '@playwright/test'
import { serverWorkouts, signUp } from './helpers'
import { createTemplate, finish, logSets, startFromTemplate } from './workout-flow'

// PRODUCT_SPEC.md §4.3 / plan/phase-04: start from a template, log sets including a
// failure set (reps must be typed), finish, and see it on the server; then the same
// with the device offline, syncing after reconnect.

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

// UI_DESIGN.md §5.4: a just-completed set that beats earlier workouts gets a gold chip;
// the first workout of an exercise is the baseline and gets none.
test('a set that beats the previous workout shows the PR chip', async ({ page }) => {
  await signUp(page)
  await createTemplate(page, 'Push Day')

  await startFromTemplate(page, 'Push Day')
  await logSets(page)
  await expect(page.getByText('e1RM PR')).toHaveCount(0)
  await finish(page)

  await startFromTemplate(page, 'Push Day')
  const set1 = page.getByRole('group', { name: 'Set 1' })
  await set1.getByLabel('Set 1 weight in kg').fill('65')
  await expect(page.getByText('e1RM PR')).toHaveCount(0)
  await set1.getByRole('button', { name: 'Complete set 1' }).click()
  await expect(set1.getByText('e1RM PR')).toBeVisible()
})
