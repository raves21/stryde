import { createECDH, randomBytes } from 'node:crypto'
import webpush from 'web-push'

// Run under Bun (`bun src/scripts/check-web-push.ts`): web-push leans on node:crypto, so
// this proves VAPID signing and payload encryption work on the runtime the API ships on.
// `web-push.test.ts` runs it as a subprocess.

const vapid = webpush.generateVAPIDKeys()
const browser = createECDH('prime256v1')
browser.generateKeys()
const subscription = {
  endpoint: 'https://push.example.test/send/abc',
  keys: {
    p256dh: browser.getPublicKey().toString('base64url'),
    auth: randomBytes(16).toString('base64url'),
  },
}

const request = webpush.generateRequestDetails(
  subscription,
  JSON.stringify({ type: 'reaction_received', title: 'Test', body: 'Hello', url: '/', tag: 't' }),
  {
    TTL: 60,
    vapidDetails: {
      subject: 'mailto:test@example.com',
      publicKey: vapid.publicKey,
      privateKey: vapid.privateKey,
    },
  },
)

const problems: string[] = []
if (request.method !== 'POST') problems.push(`method ${request.method}`)
if (request.endpoint !== subscription.endpoint) problems.push('endpoint changed')
if (!Buffer.isBuffer(request.body) || request.body.length < 40)
  problems.push('payload not encrypted')
if (request.headers['Content-Encoding'] !== 'aes128gcm') problems.push('wrong content encoding')
if (!String(request.headers.Authorization).startsWith('vapid t=')) problems.push('no VAPID header')
if (String(request.headers.TTL) !== '60') problems.push('TTL missing')
if (String(request.body).includes('Hello')) problems.push('payload is not encrypted')

if (problems.length > 0) {
  console.error(`web-push check failed: ${problems.join(', ')}`)
  process.exit(1)
}
console.log(`web-push ok on ${typeof Bun === 'undefined' ? 'node' : `bun ${Bun.version}`}`)
