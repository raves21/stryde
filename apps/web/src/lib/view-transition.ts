// Direction of a page transition (see the view-transition rules in styles/globals.css):
// `forward` goes deeper into a screen, `back` comes out of one, `fade` is a sideways move
// such as switching tabs. Returns false when the path didn't change (search params only).

const TABS = new Set(['/', '/feed', '/progress', '/profile'])

const normalize = (pathname: string) =>
  pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname

const depth = (pathname: string) => normalize(pathname).split('/').filter(Boolean).length

export type TransitionType = 'forward' | 'back' | 'fade'

export function transitionType(from: string, to: string): TransitionType | false {
  const a = normalize(from)
  const b = normalize(to)
  if (a === b) return false
  const fromTab = TABS.has(a)
  const toTab = TABS.has(b)
  if (fromTab && toTab) return 'fade'
  if (fromTab) return 'forward'
  if (toTab) return 'back'
  const delta = depth(b) - depth(a)
  return delta > 0 ? 'forward' : delta < 0 ? 'back' : 'fade'
}
