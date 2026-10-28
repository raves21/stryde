import { expect, test } from '@playwright/test'
import { serverWorkouts, signUp } from './helpers'

// plan/phase-06: load online once → offline → reload → app shell + Today render; log and
// finish a workout; go online → it syncs. Needs the production build's service worker.

test('cold start offline, log a workout, sync when back online', async ({ page, context }) => {
  await signUp(page)
  // The service worker installs on first load and takes control (clientsClaim).
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 30_000,
  })
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible()

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  // A route never opened before also loads offline: its code is precached.
  await page.goto('/progress')
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Today' }).click()

  await page.getByRole('button', { name: 'Start empty workout' }).click()
  await expect(page.getByLabel('Workout name')).toHaveValue('Workout')
  await page.getByRole('button', { name: 'Add exercise' }).click()
  const picker = page.getByRole('dialog')
  await picker.getByLabel('Search exercises').fill('Bench Press')
  await picker.getByRole('button', { name: /^Bench Press Barbell/ }).click()
  await expect(picker).toBeHidden()
  const set1 = page.getByRole('group', { name: 'Set 1' })
  await set1.getByLabel('Set 1 weight in kg').fill('60')
  await set1.getByLabel('Set 1 reps').fill('8')
  await set1.getByRole('button', { name: 'Complete set 1' }).click()
  await page.getByRole('button', { name: 'Finish' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Save workout' }).click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Offline, \d+ changes? pending/ })).toBeVisible()

  await context.setOffline(false)
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 20_000 })
  await expect
    .poll(() => serverWorkouts(page))
    .toEqual([{ name: 'Workout', sets: [[60, 8, null, 'fixed']] }])
})
