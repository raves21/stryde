import { describe, expect, it } from 'vitest'
import { RESUME_AFTER_MS, shouldApplyUpdate, type UpdateContext } from './auto-update'

const safe: UpdateContext = {
  waiting: true,
  workoutActive: false,
  unsavedWork: false,
  pathname: '/progress',
  hidden: true,
  hiddenForMs: 0,
}

describe('shouldApplyUpdate', () => {
  it.each([
    ['in the background, nothing in progress', {}, true],
    ['no update waiting', { waiting: false }, false],
    ['a workout is active', { workoutActive: true }, false],
    ['workout state still loading', { workoutActive: undefined }, false],
    ['unsaved work on screen', { unsavedWork: true }, false],
    ['on the login screen', { pathname: '/login' }, false],
    ['on sign-up', { pathname: '/signup' }, false],
    ['in onboarding', { pathname: '/onboarding' }, false],
    ['a path that merely starts like one', { pathname: '/onboardingx' }, true],
    ['the active workout screen', { pathname: '/workout/active', workoutActive: true }, false],
    ['visible, just came back after a short break', { hidden: false, hiddenForMs: 30_000 }, false],
    ['visible, never left', { hidden: false, hiddenForMs: 0 }, false],
    ['visible, back after a long absence', { hidden: false, hiddenForMs: RESUME_AFTER_MS }, true],
    [
      'long absence but a workout is active',
      { hidden: false, hiddenForMs: RESUME_AFTER_MS, workoutActive: true },
      false,
    ],
    [
      'long absence but unsaved work',
      { hidden: false, hiddenForMs: RESUME_AFTER_MS, unsavedWork: true },
      false,
    ],
  ] as const)('%s → %s', (_, over, expected) => {
    expect(shouldApplyUpdate({ ...safe, ...over })).toBe(expected)
  })
})
