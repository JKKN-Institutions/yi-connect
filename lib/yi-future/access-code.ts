/**
 * Generate a random 6-character uppercase alphanumeric access code.
 * Ambiguous chars (0, O, 1, I) excluded.
 * Uniqueness is checked at insert time in server actions scoped per edition.
 */
export function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
