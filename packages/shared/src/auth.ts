import { USERNAME_REGEX } from './constants'

/** Usernames are case-insensitive: lowercase before validating or storing. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase()
}

export function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username)
}
