// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { UserAvatar } from './user-avatar'

const srcOf = (username: string | null, displayName?: string) => {
  const { container, unmount } = render(
    <UserAvatar username={username} displayName={displayName} />,
  )
  const src = container.querySelector('img')?.getAttribute('src') ?? null
  const hasSvg = container.querySelector('svg') !== null
  unmount()
  return { src, hasSvg }
}

describe('UserAvatar', () => {
  afterEach(cleanup)

  it('draws a static image from the username: same name, same face; other name, other face', () => {
    const a1 = srcOf('marco_r')
    const a2 = srcOf('marco_r')
    const b = srcOf('aiko_t')
    expect(a1.src).toBeTruthy()
    expect(a1.src).toBe(a2.src)
    expect(b.src).not.toBe(a1.src)
  })

  it('is not animated: a plain <img>, never the inline SVG the animated mode renders', () => {
    expect(srcOf('marco_r').hasSvg).toBe(false)
  })

  it('does not depend on the display name or a photo when there is a username', () => {
    expect(srcOf('marco_r', 'Marco Reyes').src).toBe(srcOf('marco_r', 'Someone Else').src)
  })

  it('falls back to the display name before a username exists', () => {
    expect(srcOf(null, 'Marco Reyes').src).toBe(srcOf('', 'Marco Reyes').src)
    expect(srcOf(null, 'Marco Reyes').src).not.toBe(srcOf(null, 'Aiko Tanaka').src)
  })

  it('is decorative: the name is always shown next to it', () => {
    const { container } = render(<UserAvatar username="marco_r" />)
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('')
  })
})
