const isProduction = process.env.NODE_ENV === 'production'

function required(name: string, devDefault: string): string {
  const value = process.env[name]
  if (value) return value
  if (isProduction) throw new Error(`Missing required env var ${name}`)
  return devDefault
}

export const env = {
  isProduction,
  port: Number(process.env.PORT ?? 3000),
  publicUrl: required('PUBLIC_URL', 'http://localhost:5173'),
  databaseUrl: required('DATABASE_URL', 'postgres://stryde:stryde@localhost:5432/stryde'),
  betterAuthSecret: required('BETTER_AUTH_SECRET', 'dev-only-secret-change-me-in-production-32b'),
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
}
