import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from './app'

// Static SPA serving from the API (plan/phase-07 §2). No database needed.

describe('SPA static serving', () => {
  let root: string
  let app: ReturnType<typeof createApp>

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'stryde-static-'))
    await mkdir(path.join(root, 'assets'))
    await writeFile(path.join(root, 'index.html'), '<!doctype html><title>Stryde</title>')
    await writeFile(path.join(root, 'assets', 'index-abc123.js'), 'console.log(1)')
    await writeFile(path.join(root, 'sw.js'), 'self')
    await writeFile(path.join(root, 'manifest.webmanifest'), '{}')
    await writeFile(path.join(root, 'pwa-192x192.png'), 'png')
    app = createApp(root)
  })
  afterAll(() => rm(root, { recursive: true, force: true }))

  it.each([
    ['/', 'text/html; charset=utf-8', 'no-cache', '<!doctype html>'],
    ['/workout/active', 'text/html; charset=utf-8', 'no-cache', '<!doctype html>'],
    [
      '/assets/index-abc123.js',
      'text/javascript; charset=utf-8',
      'public, max-age=31536000, immutable',
      'console',
    ],
    ['/sw.js', 'text/javascript; charset=utf-8', 'no-cache', 'self'],
    ['/manifest.webmanifest', 'application/manifest+json', 'no-cache', '{}'],
    ['/pwa-192x192.png', 'image/png', 'public, max-age=3600', 'png'],
  ])('GET %s', async (url, type, cache, body) => {
    const res = await app.request(url)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe(type)
    expect(res.headers.get('cache-control')).toBe(cache)
    expect(await res.text()).toContain(body)
  })

  it('a missing file is a 404, never index.html (the SW would cache HTML as JS)', async () => {
    const res = await app.request('/assets/gone-123.js')
    expect(res.status).toBe(404)
    expect(await res.text()).not.toContain('<!doctype html>')
  })

  it('does not serve files outside the root', async () => {
    for (const url of ['/..%2F..%2Fetc%2Fpasswd', '/%2e%2e/%2e%2e/etc/hosts']) {
      const res = await app.request(url)
      expect(await res.text()).not.toMatch(/root:|localhost/)
    }
  })

  it('leaves /api to the API', async () => {
    expect((await app.request('/api/health')).status).toBe(200)
    const missing = await app.request('/api/nope')
    expect(missing.status).toBe(404)
    expect(await missing.text()).not.toContain('<!doctype html>')
  })

  it('HEAD returns headers without a body', async () => {
    const res = await app.request('/', { method: 'HEAD' })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-length')).toBe('36')
    expect(await res.text()).toBe('')
  })
})
