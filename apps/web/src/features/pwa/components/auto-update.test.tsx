// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APPLY_DELAY_MS, RESUME_AFTER_MS } from '../auto-update'

const update = vi.fn(async () => {})
const reload = vi.fn()
const state = {
  needRefresh: true,
  active: null as { id: string } | null | undefined,
  unsaved: false,
}

let onNeedReload: (() => void) | undefined
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options: { onNeedReload?: () => void }) => {
    onNeedReload = options.onNeedReload
    return { needRefresh: [state.needRefresh, () => {}], updateServiceWorker: update }
  },
}))
vi.mock('@/features/workout/use-workout', () => ({ useActiveSession: () => state.active }))
vi.mock('@/lib/unsaved-work', () => ({ hasUnsavedWork: () => state.unsaved }))

const { AutoUpdate } = await import('./auto-update')

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

/** Leave the app and wait out the short pause before the update is applied. */
function leave() {
  setHidden(true)
  wait(APPLY_DELAY_MS)
}

describe('AutoUpdate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-09T10:00:00Z'))
    update.mockClear()
    reload.mockClear()
    Object.assign(state, { needRefresh: true, active: null, unsaved: false })
    window.history.replaceState({}, '', '/progress')
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/progress', reload },
      configurable: true,
    })
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('shows no prompt and does nothing while the app is in front', () => {
    const view = render(<AutoUpdate />)
    wait(60_000)
    expect(view.container.innerHTML).toBe('')
    expect(update).not.toHaveBeenCalled()
  })

  it('applies the update shortly after you leave the app, when nothing is in progress', () => {
    render(<AutoUpdate />)
    setHidden(true)
    expect(update).not.toHaveBeenCalled() // not in the very instant of leaving
    wait(APPLY_DELAY_MS)
    expect(update).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('does nothing if you come straight back', () => {
    render(<AutoUpdate />)
    setHidden(true)
    wait(APPLY_DELAY_MS - 500)
    setHidden(false)
    wait(APPLY_DELAY_MS)
    expect(update).not.toHaveBeenCalled()
  })

  it('applies it only once', () => {
    render(<AutoUpdate />)
    leave()
    setHidden(false)
    leave()
    expect(update).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a workout is active', () => (state.active = { id: 's1' })],
    ['the workout state is still loading', () => (state.active = undefined)],
    ['unsaved work is on screen', () => (state.unsaved = true)],
    ['no update is waiting', () => (state.needRefresh = false)],
  ])('does not apply when %s', (_, arrange) => {
    arrange()
    render(<AutoUpdate />)
    leave()
    expect(update).not.toHaveBeenCalled()
  })

  it('does not apply on the login screen', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/login', reload },
      configurable: true,
    })
    render(<AutoUpdate />)
    leave()
    expect(update).not.toHaveBeenCalled()
  })

  it('waits out a workout, then applies as soon as it is over while still in the background', () => {
    state.active = { id: 's1' }
    const view = render(<AutoUpdate />)
    leave()
    expect(update).not.toHaveBeenCalled()
    state.active = null
    view.rerender(<AutoUpdate />)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('applies when an update arrives while the app is already in the background', () => {
    state.needRefresh = false
    const view = render(<AutoUpdate />)
    leave()
    expect(update).not.toHaveBeenCalled()
    state.needRefresh = true
    view.rerender(<AutoUpdate />)
    expect(update).toHaveBeenCalledTimes(1)
  })

  // `unsaved` is read live (not through a render), so it can change while the app is away.
  it('applies on return after a long absence, if it was blocked when the app was left', () => {
    state.unsaved = true
    render(<AutoUpdate />)
    leave()
    expect(update).not.toHaveBeenCalled()
    state.unsaved = false
    wait(RESUME_AFTER_MS)
    setHidden(false)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('does not apply on return after only a short break', () => {
    state.unsaved = true
    render(<AutoUpdate />)
    leave()
    state.unsaved = false
    wait(60_000)
    setHidden(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('does not apply on a long return if something is in progress again', () => {
    state.unsaved = true
    render(<AutoUpdate />)
    leave()
    wait(RESUME_AFTER_MS)
    setHidden(false) // still unsaved
    expect(update).not.toHaveBeenCalled()
  })

  describe('when the new version has already taken over (the page still runs the old one)', () => {
    it('reloads right away if the app is in the background and nothing is in progress', () => {
      state.needRefresh = false
      render(<AutoUpdate />)
      setHidden(true)
      onNeedReload?.()
      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('does not reload in front of you', () => {
      render(<AutoUpdate />)
      onNeedReload?.()
      expect(reload).not.toHaveBeenCalled()
    })

    it('does not reload during a workout', () => {
      state.active = { id: 's1' }
      render(<AutoUpdate />)
      setHidden(true)
      onNeedReload?.()
      expect(reload).not.toHaveBeenCalled()
    })

    it('does not reload with unsaved work on screen', () => {
      state.unsaved = true
      render(<AutoUpdate />)
      setHidden(true)
      onNeedReload?.()
      expect(reload).not.toHaveBeenCalled()
    })

    it('holds the reload until it is safe, then does it when you next leave the app', () => {
      state.unsaved = true
      render(<AutoUpdate />)
      setHidden(true)
      onNeedReload?.()
      expect(reload).not.toHaveBeenCalled()
      state.unsaved = false
      setHidden(false)
      setHidden(true)
      wait(APPLY_DELAY_MS)
      expect(reload).toHaveBeenCalledTimes(1)
      // And no second activation is asked for.
      expect(update).not.toHaveBeenCalled()
    })
  })
})
