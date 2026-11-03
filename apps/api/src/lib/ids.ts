const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True for a well-formed UUID; anything else can't match a row, so routes answer 404. */
export const isUuid = (value: string): boolean => UUID.test(value)
