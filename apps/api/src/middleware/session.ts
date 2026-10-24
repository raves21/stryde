import { createMiddleware } from 'hono/factory'
import { type AuthSession, auth } from '../auth'
import { apiError } from '../lib/errors'

export type AuthEnv = {
  Variables: {
    user: AuthSession['user']
    session: AuthSession['session']
  }
}

/** Rejects with 401 unless the request carries a valid session cookie. */
export const requireSession = createMiddleware<AuthEnv>(async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!result) return apiError(c, 401, 'unauthorized', 'Sign in required')
  c.set('user', result.user)
  c.set('session', result.session)
  await next()
})
