import type { SessionTree } from '@/db/repositories/sessions'

/** A sport session: every exercise in it is a sport (sports are always their own session). */
export function isSportTree(tree: SessionTree): boolean {
  return tree.exercises.length > 0 && tree.exercises.every((e) => e.exercise?.type === 'sport')
}
