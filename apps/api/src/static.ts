import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type { MiddlewareHandler } from 'hono'

// Serves the built SPA from the same origin as the API (IMPLEMENTATION_PLAN.md §1).
// node:fs keeps app.ts runtime-agnostic (Bun in production, Vitest in tests).

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
}

/** Files that must be revalidated on every load so updates reach users. */
const NO_CACHE = new Set(['/index.html', '/sw.js', '/manifest.webmanifest', '/registerSW.js'])

function cacheControl(urlPath: string): string {
  if (NO_CACHE.has(urlPath)) return 'no-cache'
  // Vite content-hashes everything under /assets.
  if (urlPath.startsWith('/assets/')) return 'public, max-age=31536000, immutable'
  return 'public, max-age=3600'
}

async function fileAt(root: string, urlPath: string): Promise<string | null> {
  let decoded: string
  try {
    decoded = decodeURIComponent(urlPath)
  } catch {
    return null
  }
  const file = path.resolve(root, `.${decoded}`)
  // Never serve anything outside the root (e.g. /../../etc/passwd).
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) return null
  try {
    return (await stat(file)).isFile() ? file : null
  } catch {
    return null
  }
}

/**
 * GET/HEAD for anything outside /api: the file if it exists; else, for extension-less
 * paths (SPA routes like /workout/active), index.html. A missing file with an extension
 * (e.g. an old hashed chunk after a deploy) is a 404, never HTML with a 200 that the
 * service worker could cache as JavaScript. Unknown /api paths fall through to a 404.
 */
export function serveSpa(rootDir: string): MiddlewareHandler {
  const root = path.resolve(rootDir)
  return async (c, next) => {
    const method = c.req.method
    const urlPath = c.req.path
    if (
      (method !== 'GET' && method !== 'HEAD') ||
      urlPath === '/api' ||
      urlPath.startsWith('/api/')
    ) {
      return next()
    }
    const found = urlPath === '/' ? null : await fileAt(root, urlPath)
    if (!found && path.extname(urlPath) !== '') return next()
    const servedPath = found ? urlPath : '/index.html'
    const file = found ?? path.join(root, 'index.html')
    let body: Buffer
    try {
      body = await readFile(file)
    } catch {
      return next()
    }
    const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
    return new Response(method === 'HEAD' ? null : new Uint8Array(body), {
      headers: {
        'Content-Type': type,
        'Cache-Control': cacheControl(servedPath),
        'Content-Length': String(body.byteLength),
      },
    })
  }
}
