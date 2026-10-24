import { usernameClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

// Same origin: Better Auth is served at /api/auth (Vite proxies it in dev).
export const authClient = createAuthClient({
  plugins: [usernameClient({ displayUsername: false })],
})
