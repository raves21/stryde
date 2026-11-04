import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// web-push under Bun, the runtime the API runs on (plan/phase-09 §1): signs a VAPID
// header and encrypts a payload. Vitest itself runs on Node, so this spawns Bun.

describe('web-push on Bun', () => {
  it('signs and encrypts a payload', () => {
    const script = fileURLToPath(new URL('./check-web-push.ts', import.meta.url))
    const output = execFileSync('bun', [script], { encoding: 'utf8' })
    expect(output).toMatch(/^web-push ok on bun /)
  })
})
