import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { InstallStep } from '@/features/onboarding/install-step'
import { ProgressDots } from '@/features/onboarding/progress-dots'
import { UnitsStep } from '@/features/onboarding/units-step'
import { UsernameStep } from '@/features/onboarding/username-step'

export const Route = createFileRoute('/onboarding')({
  component: OnboardingPage,
})

type Step = 'username' | 'units' | 'install'

function OnboardingPage() {
  const { user } = Route.useRouteContext()
  const navigate = useNavigate()
  // Decide the steps once: the username step stays in the list after it's done.
  const [steps] = useState<Step[]>(() =>
    user?.needsOnboarding ? ['username', 'units', 'install'] : ['units', 'install'],
  )
  const [index, setIndex] = useState(0)
  const step = steps[index]

  function next() {
    if (index < steps.length - 1) setIndex(index + 1)
    else void navigate({ to: '/' })
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-10 px-4 py-12">
      <ProgressDots count={steps.length} current={index} />
      {step === 'username' && <UsernameStep onDone={next} />}
      {step === 'units' && <UnitsStep initial={user?.settings.unit ?? 'kg'} onDone={next} />}
      {step === 'install' && <InstallStep onDone={next} />}
    </main>
  )
}
