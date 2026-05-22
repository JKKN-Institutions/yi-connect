/**
 * Slug utilities for public event URLs.
 *
 * Generates short, URL-safe slugs from event titles. The format is
 * `kebab-case-title-xxxx` where `xxxx` is a 4-character random suffix,
 * giving ~1.7M distinct suffixes per title — enough to survive the
 * handful of UNIQUE conflicts we can expect in a single chapter.
 */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SUFFIX_LENGTH = 4;
const MAX_BASE_LENGTH = 60;

/**
 * Slugify an arbitrary string:
 *   - Lowercase
 *   - Strip accents (NFKD decompose)
 *   - Replace any run of non-alphanumeric chars with a single hyphen
 *   - Trim leading/trailing hyphens
 *   - Truncate to `maxLen` chars (word-boundary-friendly)
 */
export function slugify(input: string, maxLen = MAX_BASE_LENGTH): string {
  const normalized = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (normalized.length <= maxLen) return normalized;

  // Truncate at maxLen, then trim trailing partial-word hyphen
  const truncated = normalized.slice(0, maxLen).replace(/-+$/g, '');
  return truncated;
}

/**
 * Generate a 4-char lowercase alphanumeric suffix using crypto.getRandomValues.
 */
export function randomSuffix(length: number = SUFFIX_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/**
 * Build a public event slug from a title: `kebab-title-xxxx`.
 *
 * Example:
 *   generateEventSlug('Networking Dinner — April 2026!')
 *   → 'networking-dinner-april-2026-k3x9'
 *
 * If the title slugifies to empty (e.g. pure symbols), falls back to
 * the suffix alone prefixed with `event-`.
 */
export function generateEventSlug(title: string): string {
  const base = slugify(title);
  const suffix = randomSuffix();
  if (!base) return `event-${suffix}`;
  return `${base}-${suffix}`;
}

/**
 * Given an existing slug, rotate just the suffix — used for retry loops
 * after a UNIQUE violation.
 */
export function rotateSlugSuffix(existing: string): string {
  // Trim any existing `-xxxx` suffix (4 alphanumeric chars at end)
  const base = existing.replace(/-[a-z0-9]{4}$/, '');
  const suffix = randomSuffix();
  return `${base || 'event'}-${suffix}`;
}
