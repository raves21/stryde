import { expect, test } from '@playwright/test'
import { signUp } from './helpers'

// Sports (pickleball, tennis…): started from Today or the center button, played as games on a
// pausable clock from 0:00, analysed apart from the gym (Sports tabs), shown in the calendar.

test('play two games with pause and resume, then see the sport apart from the gym', async ({
  page,
}) => {
  await signUp(page)

  await page.getByRole('button', { name: 'Start a sport' }).click()
  const picker = page.getByRole('dialog')
  // Six presets, no muscle-group chips.
  for (const sport of ['Pickleball', 'Badminton', 'Basketball', 'Tennis', 'Soccer', 'Volleyball']) {
    await expect(picker.getByRole('button', { name: new RegExp(`^${sport}`) })).toBeVisible()
  }
  await picker.getByRole('button', { name: /^Pickleball/ }).click()

  // Game 1 is already running from 0:00; there are no sets.
  await expect(page.getByRole('heading', { name: 'Pickleball' })).toBeVisible()
  const timer = page.getByRole('timer', { name: 'Game 1 time' })
  await expect(page.getByRole('button', { name: 'Add set' })).toHaveCount(0)
  await expect(timer).not.toHaveText('0:00')

  // Pause stops the clock; Resume continues it.
  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByText('Game 1 · Paused')).toBeVisible()
  const frozen = await timer.textContent()
  await page.waitForTimeout(1500)
  await expect(timer).toHaveText(frozen ?? '')
  await page.getByRole('button', { name: 'Resume' }).click()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()

  // Finishing the game saves it and leaves game 2 waiting at 0:00.
  await page.getByRole('button', { name: 'Finish game 1' }).click()
  await expect(page.getByRole('button', { name: 'Start game 2' })).toBeVisible()
  await expect(page.getByRole('timer', { name: 'Game 2 time' })).toHaveText('0:00')
  await expect(page.getByRole('listitem').filter({ hasText: 'Game 1' })).toBeVisible()

  // Game 2 starts from 0:00 as well.
  await page.getByRole('button', { name: 'Start game 2' }).click()
  await expect(page.getByRole('timer', { name: 'Game 2 time' })).not.toHaveText('0:00')
  await page.getByLabel('Notes').fill('Doubles, won 2 of 3')
  await page.getByRole('button', { name: 'End session' }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByText('2 games played')).toBeVisible()
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  // A sport is not a workout: Today's recent workouts stay empty.
  await expect(page.getByText('No workouts yet')).toBeVisible()

  // History keeps sports on their own tab.
  await page.goto('/history')
  await expect(page.getByText('No workouts yet')).toBeVisible()
  await page.getByRole('tab', { name: 'Sports' }).click()
  const row = page.getByRole('link', { name: /Pickleball/ })
  await expect(row).toContainText('2 games')

  // Detail: games and notes, no set tables. Fix both games to 40 and 35 minutes.
  await row.click()
  await expect(page.getByText('Doubles, won 2 of 3')).toBeVisible()
  await expect(page.getByText('Game 2')).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  await page.getByRole('button', { name: 'Workout options' }).click()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  await page.getByLabel('Game 1 minutes').fill('40')
  await page.getByLabel('Game 2 minutes').fill('35')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText('1h 15m').first()).toBeVisible()

  // Progress: the sport has its own tab; the gym tab doesn't count it.
  await page.goto('/progress')
  await expect(page.getByText('Total workouts').locator('..')).toContainText('0')
  await page.getByRole('tab', { name: 'Sports' }).click()
  await expect(page.getByText('Played this week').locator('..')).toContainText('1h 15m')
  await expect(page.getByText('By sport')).toBeVisible()

  // The feed card shows the time played and the games (own sessions appear after syncing).
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 20_000 })
  await page.goto('/feed')
  const card = page.getByRole('article').filter({ hasText: 'Pickleball' })
  await expect(card).toContainText('1h 15m')
  await expect(card).toContainText('2 games')
  await expect(card).not.toContainText('exercises')
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
