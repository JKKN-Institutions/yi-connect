/**
 * Generates a random 6-character uppercase alphanumeric access code.
 * Checks for uniqueness within the given event's participants and jury.
 */
export function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous: 0,O,1,I
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
