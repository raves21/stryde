import { expect, type Page } from '@playwright/test'

/** "Bench": set 1 fixed 5 reps @ 60 kg, set 2 to failure. */
export async function createTemplate(page: Page, name: string) {
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

export async function startFromTemplate(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Start' }).click()
  await expect(page.getByLabel('Workout name')).toHaveValue(name)
}

/** Log both sets; the failure set needs typed reps before ✓ unlocks. */
export async function logSets(page: Page) {
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

export async function finish(page: Page) {
  await page.getByRole('button', { name: 'Finish' }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByText('Exercises')).toBeVisible()
  await sheet.getByRole('button', { name: 'Save workout' }).click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
}
