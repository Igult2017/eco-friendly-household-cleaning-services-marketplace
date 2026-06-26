export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True when the string is a canonical UUID. Guard route `[id]` params before querying so a
 *  malformed id returns a clean 400 instead of a Postgres uuid-cast 500. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}
