import { expect, test } from '@playwright/test'
import { signUp } from './helpers'

// Sports (pickleball, tennis…): started from Today or the center button, timed, finished
// with the minutes (editable) and notes, shown as time only, counted as active minutes.

test('start a sport, finish it, and see it as time: history, progress, feed', async ({ page }) => {
  await signUp(page)

  await page.getByRole('button', { name: 'Start a sport' }).click()
  const picker = page.getByRole('dialog')
  // Six presets, no muscle-group chips.
  for (const sport of ['Pickleball', 'Badminton', 'Basketball', 'Tennis', 'Soccer', 'Volleyball']) {
    await expect(picker.getByRole('button', { name: new RegExp(`^${sport}`) })).toBeVisible()
  }
  await picker.getByRole('button', { name: /^Pickleball/ }).click()

  // The sport screen: a timer and notes, no sets.
  await expect(page.getByRole('heading', { name: 'Pickleball' })).toBeVisible()
  await expect(page.getByRole('timer', { name: 'Time played' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add set' })).toHaveCount(0)
  await page.getByLabel('Notes').fill('Doubles, won 2 of 3')

  // Finish with the minutes from the timer, edited to 75.
  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByLabel('Minutes played')).toHaveValue('1')
  await sheet.getByLabel('Minutes played').fill('75')
  await expect(sheet.getByText('1h 15m')).toBeVisible()
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()

  // History: time and "Sport", not sets.
  await page.goto('/history')
  const row = page.getByRole('link', { name: /Pickleball/ })
  await expect(row).toContainText('1h 15m · Sport')

  // Its detail: duration and the notes, no set tables.
  await row.click()
  await expect(page.getByText('Doubles, won 2 of 3')).toBeVisible()
  await expect(page.getByText('1h 15m').first()).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)

  // Progress: active minutes, and it is not a workout.
  await page.goto('/progress')
  await expect(page.getByText('Active minutes')).toBeVisible()
  await expect(page.getByText('1h 15m').first()).toBeVisible()
  await expect(page.getByText('Total workouts').locator('..')).toContainText('0')

  // The feed card shows the time and "Sport" (own sessions appear after syncing).
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 20_000 })
  await page.goto('/feed')
  const card = page.getByRole('article').filter({ hasText: 'Pickleball' })
  await expect(card).toContainText('1h 15m')
  await expect(card).toContainText('Sport')
  await expect(card).not.toContainText('exercises')
  await expect(card).not.toContainText('sets')
})

test('sports start from the center button too, can be custom, and stay out of gym workouts', async ({
  page,
}) => {
  await signUp(page)

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('button', { name: /Start/ })
    .click()
  await page.getByRole('button', { name: 'Start a sport' }).click()
  await page.getByRole('button', { name: 'Create custom sport' }).click()
  const form = page.getByRole('dialog').last()
  await expect(form.getByLabel('Muscle group')).toHaveCount(0) // a sport is just a name
  await form.getByLabel('Name').fill('Table tennis')
  await form.getByRole('button', { name: 'Create sport' }).click()
  await expect(page.getByRole('heading', { name: 'Table tennis' })).toBeVisible()

  // Discard it, then check that gym pickers don't offer sports.
  await page.getByRole('button', { name: 'Discard', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard' }).click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()

  await page.getByRole('button', { name: 'Start empty workout' }).click()
  await page.getByRole('button', { name: 'Add exercise' }).click()
  const picker = page.getByRole('dialog')
  await picker.getByLabel('Search exercises').fill('Pickleball')
  await expect(picker.getByText(/No exercises match/)).toBeVisible()
  await picker.getByLabel('Search exercises').fill('Table tennis')
  await expect(picker.getByText(/No exercises match/)).toBeVisible()
})
