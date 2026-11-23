/**
 * Yi Erode EC 2027 EOI: members rank their picks (Director 23 Nov 2026).
 * The order is saved inside commitment_version as "<version>;ranked=<id>,<id>"
 * so no database change was needed. Entries saved before ranking carry the bare
 * version and read back as "not ranked". Pure functions, unit-tested.
 */
const RANK_MARK = ';ranked='

export function withRanking(version: string, roleIdsInOrder: readonly string[]): string {
  return version + RANK_MARK + roleIdsInOrder.join(',')
}

/** The member's order (1st choice first), or null when the entry was not ranked or does not match its answers. */
export function readRanking(version: string | null, answerIds: ReadonlySet<string>): string[] | null {
  const at = (version ?? '').indexOf(RANK_MARK)
  if (at < 0) return null
  const ids = version!.slice(at + RANK_MARK.length).split(',')
  return ids.length === answerIds.size && new Set(ids).size === ids.length && ids.every(id => answerIds.has(id)) ? ids : null
}
