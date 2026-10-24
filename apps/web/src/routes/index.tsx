import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: Home,
})

type Health = { ok: boolean; version: string }

function Home() {
  const [health, setHealth] = useState<Health | 'offline' | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json() as Promise<Health>)
      .then(setHealth)
      .catch(() => setHealth('offline'))
  }, [])

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 pt-16">
      <h1 className="font-display text-[40px] font-bold uppercase leading-none tracking-tight">
        Stryde
      </h1>
      <p className="text-muted-foreground">Phase 0 scaffold.</p>
      <Button size="lg">Start workout</Button>
      <p className="text-sm text-faint">
        API:{' '}
        {health === null
          ? 'checking…'
          : health === 'offline'
            ? 'unreachable'
            : `ok (${health.version})`}
      </p>
    </main>
  )
}
