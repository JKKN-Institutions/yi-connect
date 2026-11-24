/**
 * Yi Erode EC 2027 EOI: help members spread their picks (Director 24 Nov 2026).
 * Six areas had no picks after the first 6 entries, so the form shows the
 * areas in a random order per visitor and tags under-chosen ones "Needs people".
 * Pure functions, unit-tested. Members never see counts, only the tag.
 */

/** Areas picked fewer than a quarter as often as the most-picked area (always at least the zero-pick ones). */
export function needsPeople(roleIds: readonly string[], picks: readonly (readonly string[])[]): string[] {
  if (picks.length === 0) return []
  const count = new Map(roleIds.map(id => [id, 0]))
  for (const entry of picks) for (const id of new Set(entry)) if (count.has(id)) count.set(id, count.get(id)! + 1)
  const max = Math.max(...count.values())
  const below = Math.max(1, Math.ceil(max / 4))
  return roleIds.filter(id => count.get(id)! < below)
}

/** Fisher-Yates on a copy. `random` is injectable for tests. */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
