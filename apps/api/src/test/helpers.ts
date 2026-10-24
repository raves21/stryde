import { app } from '../app'

export const hasDatabase = process.env.STRYDE_INTEGRATION === '1'

const ORIGIN = 'http://localhost:5173'

export function postJson(path: string, body: unknown, cookie?: string) {
  return app.request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

export function get(path: string, cookie?: string) {
  return app.request(path, { headers: { Origin: ORIGIN, ...(cookie ? { Cookie: cookie } : {}) } })
}

/** `name=value; name2=value2` from a response's Set-Cookie headers. */
export function cookieFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
}

let counter = 0
export function uniqueUser() {
  counter += 1
  const suffix = `${Date.now().toString(36)}${counter}`
  return {
    email: `user_${suffix}@example.com`,
    username: `u_${suffix}`.slice(0, 20),
    password: 'correct-horse-battery',
    name: 'Test User',
  }
}
