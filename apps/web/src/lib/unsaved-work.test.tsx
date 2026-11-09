// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { hasUnsavedWork, useUnsavedWork } from './unsaved-work'

function Screen({ active }: { active: boolean }) {
  useUnsavedWork(active)
  return null
}

describe('unsaved work flag', () => {
  afterEach(cleanup)

  it('is set while a screen holds unsaved work, cleared when it is saved or unmounted', () => {
    expect(hasUnsavedWork()).toBe(false)
    const view = render(<Screen active />)
    expect(hasUnsavedWork()).toBe(true)
    view.rerender(<Screen active={false} />)
    expect(hasUnsavedWork()).toBe(false)
    view.rerender(<Screen active />)
    view.unmount()
    expect(hasUnsavedWork()).toBe(false)
  })

  it('stays set until every holder is done', () => {
    const a = render(<Screen active />)
    const b = render(<Screen active />)
    a.unmount()
    expect(hasUnsavedWork()).toBe(true)
    b.unmount()
    expect(hasUnsavedWork()).toBe(false)
  })
})
