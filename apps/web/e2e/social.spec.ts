import { expect, test } from '@playwright/test'
import { signUp } from './helpers'
import { createTemplate, finish, logSets, startFromTemplate } from './workout-flow'

// plan/phase-08: two users become friends, one finishes a workout, the other sees it in
// the feed, reacts, and the first sees the reaction. Social is online-only.

test('friends see each other’s workouts and reactions; offline shows an offline state', async ({
  browser,
}) => {
  const ann = await (await browser.newContext()).newPage()
  const bobContext = await browser.newContext()
  const bob = await bobContext.newPage()
  const annName = await signUp(ann)
  await signUp(bob)

  // Bob adds Ann by username.
  await bob.goto('/friends')
  await bob.getByLabel('Add by username').fill(annName)
  await bob.getByRole('button', { name: /^Add / }).click()
  await expect(bob.getByText('Requested')).toBeVisible()

  // Ann accepts from the Requests tab.
  await ann.goto('/friends')
  await ann.getByRole('tab', { name: /Requests/ }).click()
  await ann.getByRole('button', { name: /^Accept / }).click()
  await ann.getByRole('tab', { name: 'Friends' }).click()
  await expect(ann.getByText('Juan Dela Cruz')).toBeVisible()

  // Ann finishes a workout (shared by default).
  await ann.goto('/')
  await createTemplate(ann, 'Push Day')
  await startFromTemplate(ann, 'Push Day')
  await logSets(ann)
  await finish(ann)

  // It shows up in Bob's feed once Ann's device has synced.
  await bob.goto('/feed')
  const card = bob.getByRole('article').filter({ hasText: 'Push Day' })
  await expect(async () => {
    await bob.reload()
    await expect(card).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  await expect(card).toContainText('1 exercise')
  await expect(card).toContainText('2 sets')

  // Bob reacts; the same tap on the same emoji later would remove it.
  await card.getByRole('button', { name: 'React' }).click()
  await bob.getByRole('button', { name: 'Fire' }).click()
  await expect(card.getByRole('button', { name: /1 fire reactions/ })).toBeVisible()

  // Tap through to the friend's session detail: read-only, with Ann's sets.
  await card.getByRole('link').click()
  await expect(bob.getByRole('heading', { name: 'Bench Press' })).toBeVisible()
  await expect(bob.getByText('60 kg × 5')).toBeVisible()
  await expect(bob.getByRole('button', { name: /1 fire reactions/ })).toBeVisible()

  // Ann sees her own card ("You") with Bob's reaction.
  await ann.goto('/feed')
  const own = ann.getByRole('article').filter({ hasText: 'Push Day' })
  await expect(own).toContainText('You')
  await expect(own.getByRole('button', { name: /1 fire reactions/ })).toBeVisible()

  // Offline: the feed isn't cached, it explains itself instead.
  await bob.goto('/feed')
  await expect(bob.getByRole('article').filter({ hasText: 'Push Day' })).toBeVisible()
  await bobContext.setOffline(true)
  await expect(bob.getByText(/You're offline\. The feed will load/)).toBeVisible()
  await bobContext.setOffline(false)
  await expect(bob.getByRole('article').filter({ hasText: 'Push Day' })).toBeVisible({
    timeout: 20_000,
  })
})
