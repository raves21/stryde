import {
  type PullResponse,
  type PushRequest,
  type PushResponse,
  pullResponseSchema,
  pushResponseSchema,
} from '@stryde/shared'

/** The session is gone: stop syncing and send the user to /login (outbox kept). */
export class UnauthorizedError extends Error {}
/** The server couldn't be reached; retry later. */
export class NetworkError extends Error {}
/** The server answered with an error or a malformed body; retry later. */
export class ServerError extends Error {}

export type SyncTransport = {
  push(request: PushRequest): Promise<PushResponse>
  pull(cursor: string, limit: number): Promise<PullResponse>
}

type HttpOptions = {
  /** '' in the app (same origin); an absolute URL in tests. */
  baseUrl?: string
  /** Extra headers, e.g. Cookie/Origin outside a browser. */
  headers?: () => Record<string, string>
}

export function httpTransport({ baseUrl = '', headers }: HttpOptions = {}): SyncTransport {
  async function request(path: string, init: RequestInit = {}): Promise<unknown> {
    let res: Response
    try {
      res = await fetch(`${baseUrl}${path}`, {
        ...init,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...headers?.() },
      })
    } catch (error) {
      throw new NetworkError(error instanceof Error ? error.message : 'Network error')
    }
    if (res.status === 401) throw new UnauthorizedError('Signed out')
    if (!res.ok) throw new ServerError(`Sync failed (${res.status})`)
    return res.json().catch(() => {
      throw new ServerError('Malformed sync response')
    })
  }

  function parse<T>(
    schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } },
    body: unknown,
  ): T {
    const result = schema.safeParse(body)
    if (!result.success) throw new ServerError('Malformed sync response')
    return result.data
  }

  return {
    async push(body) {
      const res = await request('/api/sync/push', { method: 'POST', body: JSON.stringify(body) })
      return parse(pushResponseSchema, res)
    },
    async pull(cursor, limit) {
      const res = await request(`/api/sync/pull?cursor=${cursor}&limit=${limit}`)
      return parse(pullResponseSchema, res)
    },
  }
}
