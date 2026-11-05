import { expect, test } from '@playwright/test'
import { signUp } from './helpers'

// Interaction details: template Save button, discard guard, name focus, the custom
// exercise button, zoom lock and dialog motion.

test('templates are saved with a button, and leaving unsaved changes asks first', async ({
  page,
}) => {
  await signUp(page)
  await page.goto('/templates')
  await page.getByRole('link', { name: 'New template' }).click()

  // The name field is active; Save stays off until there is something to save.
  const name = page.getByLabel('Template name')
  await expect(name).toBeFocused()
  const save = page.getByRole('button', { name: 'Save', exact: true })
  await expect(save).toBeDisabled()

  // Backing out discards (after asking); nothing was created.
  await page.keyboard.type('Draft only')
  await expect(save).toBeEnabled()
  await page.getByRole('button', { name: 'Back' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Discard your changes?')
  await dialog.getByRole('button', { name: 'Keep editing' }).click()
  await expect(name).toHaveValue('Draft only')
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click()
  await expect(page.getByRole('heading', { name: 'Templates' })).toBeVisible()
  await expect(page.getByText('Draft only')).toHaveCount(0)

  // A name is required to save; then it is saved once, on the button.
  await page.getByRole('link', { name: 'New template' }).first().click()
  await page.getByRole('button', { name: 'Add exercise' }).click()
  const picker = page.getByRole('dialog')
  // The custom exercise button is visible without scrolling.
  await expect(picker.getByRole('button', { name: 'Create custom exercise' })).toBeInViewport()
  await picker.getByLabel('Search exercises').fill('Bench Press')
  await picker.getByRole('button', { name: /^Bench Press Barbell/ }).click()
  await expect(picker).toBeHidden()
  await save.click()
  await expect(page.getByText('Give the template a name first')).toBeVisible()
  await expect(name).toBeFocused()
  await name.fill('Push Day')
  await save.click()
  await expect(page.getByText('Template saved')).toBeVisible()
  await expect(save).toBeDisabled()

  // Edits are not saved until the button; reloading the page keeps only the saved ones.
  await page.mouse.move(5, 400) // off the toast, which pauses its timer while hovered
  await expect(page.getByText('Template saved')).toBeHidden()
  await name.fill('Push Day v2')
  await expect(save).toBeEnabled()
  await save.click()
  await expect(page.getByText('Template saved')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Template name')).toHaveValue('Push Day v2')
  await expect(page.getByText('Bench Press')).toBeVisible()
})

test('the library and the picker show the custom exercise button up front', async ({ page }) => {
  await signUp(page)
  await page.goto('/exercises')
  await expect(page.getByRole('button', { name: 'Create custom exercise' })).toBeInViewport()
  await page.getByRole('button', { name: 'Create custom exercise' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('pinch zoom is locked and dialogs animate visibly', async ({ page }) => {
  await signUp(page)
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
  expect(viewport).toContain('user-scalable=no')
  expect(viewport).toContain('maximum-scale=1')
  expect(await page.evaluate(() => getComputedStyle(document.body).touchAction)).toBe('pan-x pan-y')

  // An alert dialog opens with the long, clearly visible enter animation.
  await page.goto('/templates')
  await page.getByRole('link', { name: 'New template' }).click()
  await expect(page.getByLabel('Template name')).toBeFocused()
  await page.keyboard.type('Temp')
  await page.getByRole('button', { name: 'Back' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  const motion = await dialog.evaluate((el) => {
    const style = getComputedStyle(el)
    return { name: style.animationName, duration: style.animationDuration }
  })
  expect(motion.name).toBe('enter')
  expect(Number.parseFloat(motion.duration)).toBeGreaterThanOrEqual(0.2)
})
