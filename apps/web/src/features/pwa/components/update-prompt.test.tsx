// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const toast = Object.assign(
  vi.fn(() => 'toast-id'),
  { dismiss: vi.fn() },
)
const state = { needRefresh: false, active: null as { id: string } | null | undefined }

vi.mock('sonner', () => ({ toast }))
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [state.needRefresh, () => {}],
    updateServiceWorker: vi.fn(),
  }),
}))
vi.mock('@/features/workout/use-workout', () => ({ useActiveSession: () => state.active }))

const { UpdatePrompt } = await import('./update-prompt')

describe('UpdatePrompt', () => {
  beforeEach(() => {
    toast.mockClear()
    toast.dismiss.mockClear()
  })
  afterEach(cleanup)

  it.each([
    ['no update waiting', false, null, false],
    ['update waiting, no workout', true, null, true],
    ['update waiting during a workout', true, { id: 's1' }, false],
    ['update waiting, workout state still loading', true, undefined, false],
  ] as const)('%s → toast shown: %s', (_, needRefresh, active, shown) => {
    state.needRefresh = needRefresh
    state.active = active
    render(<UpdatePrompt />)
    expect(toast).toHaveBeenCalledTimes(shown ? 1 : 0)
  })

  it('withdraws the toast when a workout starts, offers it again after', () => {
    state.needRefresh = true
    state.active = null
    const view = render(<UpdatePrompt />)
    expect(toast).toHaveBeenCalledTimes(1)
    state.active = { id: 's1' }
    view.rerender(<UpdatePrompt />)
    expect(toast.dismiss).toHaveBeenCalledWith('toast-id')
    expect(toast).toHaveBeenCalledTimes(1)
    state.active = null
    view.rerender(<UpdatePrompt />)
    expect(toast).toHaveBeenCalledTimes(2)
  })
})
