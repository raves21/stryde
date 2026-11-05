import { expect, test } from '@playwright/test'
import { befriend, signUp } from './helpers'
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
  // Ann's first set (60 kg × 5) in the set table.
  const firstSet = bob.getByRole('row').filter({ hasText: /^1\s*60\s*5/ })
  await expect(firstSet).toBeVisible()
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

// plan/phase-09: reactions and friends' workouts notify (bell + list), and open apps update
// live over SSE without a reload.
test('notifications: bell, list and live updates over SSE', async ({ browser }) => {
  const ann = await (await browser.newContext()).newPage()
  const bob = await (await browser.newContext()).newPage()
  const annName = await signUp(ann)
  const bobName = await signUp(bob)
  await befriend(bob, ann, annName)

  // Bob already has Ann's feed open when she finishes a workout: it appears live.
  await bob.goto('/feed')
  await expect(bob.getByText('Add friends to see their workouts here.')).toHaveCount(0)
  await ann.goto('/')
  await createTemplate(ann, 'Push Day')
  await startFromTemplate(ann, 'Push Day')
  await logSets(ann)
  await finish(ann)

  const card = bob.getByRole('article').filter({ hasText: 'Push Day' })
  await expect(card).toBeVisible({ timeout: 30_000 })
  // Bob's bell: the accepted request and Ann's finished workout.
  await expect(bob.getByRole('link', { name: 'Notifications, 2 unread' })).toBeVisible()

  // Ann watches her own feed; Bob reacts; her card and bell update with no reload.
  await ann.goto('/feed')
  const own = ann.getByRole('article').filter({ hasText: 'Push Day' })
  await expect(own).toBeVisible()
  // Ann starts with Bob's friend request unread.
  await expect(ann.getByRole('link', { name: 'Notifications, 1 unread' })).toBeVisible()
  await card.getByRole('button', { name: 'React' }).click()
  await bob.getByRole('button', { name: 'Fire' }).click()
  await expect(own.getByRole('button', { name: /1 fire reactions/ })).toBeVisible({
    timeout: 15_000,
  })
  await expect(ann.getByRole('link', { name: 'Notifications, 2 unread' })).toBeVisible()

  // The list: newest first, unread, tapping opens the workout and clears the dot.
  await ann.getByRole('link', { name: 'Notifications, 2 unread' }).click()
  await expect(ann.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  const item = ann.getByRole('button', { name: /reacted to Push Day/ })
  await expect(item).toContainText('🔥')
  await expect(item).toContainText('Juan Dela Cruz')
  await item.click()
  await expect(ann.getByRole('heading', { name: 'Push Day' })).toBeVisible()
  await ann.goBack()
  // The reaction is read; only the friend request is still unread.
  await expect(ann.getByRole('button', { name: /reacted to Push Day/ })).not.toContainText('Unread')
  await expect(ann.getByRole('button', { name: /friend request/ })).toContainText('Unread')
  await ann.goto('/feed')
  await expect(ann.getByRole('link', { name: 'Notifications, 1 unread' })).toBeVisible()

  // Bob's list has the friend's workout; "Mark all read" clears his bell.
  await bob.getByRole('link', { name: 'Notifications, 2 unread' }).click()
  await expect(bob.getByRole('button', { name: /Finished Push Day/ })).toBeVisible()
  await bob.getByRole('button', { name: 'Mark all read' }).click()
  await expect(bob.getByRole('button', { name: 'Mark all read' })).toHaveCount(0)
  await bob.goBack()
  await expect(bob.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible()

  // Settings: mute all disables the per-type switches.
  await ann.goto('/settings/notifications')
  await ann.getByRole('switch', { name: 'Mute all' }).click()
  await expect(ann.getByRole('switch', { name: 'Reactions' })).toBeDisabled()
  await ann.getByRole('switch', { name: 'Mute all' }).click()
  await expect(ann.getByRole('switch', { name: 'Reactions' })).toBeEnabled()
  expect(bobName).toBeTruthy()
})
