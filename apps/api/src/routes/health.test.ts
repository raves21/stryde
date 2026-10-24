import { afterEach, describe, expect, it } from 'vitest'
import { app } from '../app'

describe('GET /api/health', () => {
  const original = process.env.GIT_SHA
  afterEach(() => {
    if (original === undefined) delete process.env.GIT_SHA
    else process.env.GIT_SHA = original
  })

  it('returns ok with dev version by default', async () => {
    delete process.env.GIT_SHA
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, version: 'dev' })
  })

  it('reports GIT_SHA when set', async () => {
    process.env.GIT_SHA = 'abc123'
    const res = await app.request('/api/health')
    expect(await res.json()).toEqual({ ok: true, version: 'abc123' })
  })
})
