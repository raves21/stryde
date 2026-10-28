import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useOnline } from '@/lib/use-online'
import { usePendingCount } from '@/sync/hooks'
import { signOut } from '../session'

/** Sign out, warning first if this device still has unsynced changes (they'd be lost). */
export function SignOutButton() {
  const router = useRouter()
  const online = useOnline()
  const pendingChanges = usePendingCount()
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)

  async function run() {
    setPending(true)
    await signOut()
    await router.invalidate()
  }

  return (
    <>
      {/* Sign-out needs the server to clear the httpOnly cookie. */}
      <Button
        variant="ghost"
        onClick={() => (pendingChanges > 0 ? setConfirming(true) : run())}
        disabled={!online || pending}
      >
        {online ? 'Sign out' : 'Sign out (needs a connection)'}
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsynced changes</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChanges === 1 ? '1 change hasn’t' : `${pendingChanges} changes haven’t`}{' '}
              synced yet. Signing out deletes {pendingChanges === 1 ? 'it' : 'them'} from this
              device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay signed in</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={run} disabled={pending}>
              Sign out anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
