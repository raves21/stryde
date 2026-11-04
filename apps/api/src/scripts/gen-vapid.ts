import webpush from 'web-push'

// `bun run gen:vapid`: print a VAPID key pair for the server's .env (Web Push).
const { publicKey, privateKey } = webpush.generateVAPIDKeys()
console.log(`VAPID_PUBLIC_KEY=${publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${privateKey}`)
console.log('VAPID_SUBJECT=mailto:you@example.com   # set to your own address')
