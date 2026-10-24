export function toTestDatabaseUrl(url: string): string {
  const parsed = new URL(url)
  const name = parsed.pathname.replace(/^\//, '')
  if (!name.endsWith('_test')) parsed.pathname = `/${name}_test`
  return parsed.toString()
}
