// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { keyToBytes, pushSupport } from './push'
import { syncRestPush } from './rest-push'

describe('keyToBytes', () => {
  it('decodes a base64url VAPID key (no padding, - and _)', () => {
    // 65-byte uncompressed P-256 point as web-push generates it.
    const bytes = keyToBytes(
      'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
    )
    expect(bytes).toHaveLength(65)
    expect(bytes[0]).toBe(0x04)
  })

  it('round-trips arbitrary bytes', () => {
    const source = Uint8Array.from([251, 255, 0, 1, 2, 62, 63])
    const b64url = btoa(String.fromCharCode(...source))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect([...keyToBytes(b64url)]).toEqual([...source])
  })
})

describe('pushSupport', () => {
  const originalUA = navigator.userAgent
  afterEach(() => {
    vi.unstubAllGlobals()
    Object.defineProperty(navigator, 'userAgent', { value: originalUA, configurable: true })
  })

  it.each([
    [
      'desktop browser with the Push API',
      'Mozilla/5.0 (X11; Linux x86_64) Chrome/120',
      true,
      false,
      'supported',
    ],
    [
      'iPhone Safari in a tab (no Push API yet)',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      false,
      false,
      'ios-needs-install',
    ],
    [
      'iPhone tab even if the API exists',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      true,
      false,
      'ios-needs-install',
    ],
    [
      'iPhone installed to the Home Screen',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      true,
      true,
      'supported',
    ],
    [
      'a browser without the Push API',
      'Mozilla/5.0 (X11; Linux x86_64) Firefox/100',
      false,
      false,
      'unsupported',
    ],
  ] as const)('%s → %s', (_, ua, hasPush, standalone, expected) => {
    Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
    vi.stubGlobal('matchMedia', () => ({ matches: standalone }))
    if (hasPush) {
      vi.stubGlobal('PushManager', class {})
      vi.stubGlobal('Notification', { permission: 'default' })
      Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
    } else {
      vi.stubGlobal('PushManager', undefined)
      // `'PushManager' in window` must be false.
      Reflect.deleteProperty(window, 'PushManager')
    }
    expect(pushSupport()).toBe(expected)
  })
})

describe('syncRestPush', () => {
  const fetchMock = vi.fn(async () => new Response('{}'))
  beforeEach(() => {
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('Notification', { permission: 'granted' })
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('schedules the push for a running timer', async () => {
    await syncRestPush('s1', '2026-11-04T10:00:00.000Z')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/rest-timer',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ sessionId: 's1', fireAt: '2026-11-04T10:00:00.000Z' }),
      }),
    )
  })

  it('cancels it when the timer is cleared', async () => {
    await syncRestPush('s1', null)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/rest-timer',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it.each([
    ['without permission', () => vi.stubGlobal('Notification', { permission: 'default' })],
    [
      'offline',
      () => Object.defineProperty(navigator, 'onLine', { value: false, configurable: true }),
    ],
  ])('does nothing %s', async (_, arrange) => {
    arrange()
    await syncRestPush('s1', '2026-11-04T10:00:00.000Z')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never throws when the request fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'))
    await expect(syncRestPush('s1', null)).resolves.toBeUndefined()
  })
})
