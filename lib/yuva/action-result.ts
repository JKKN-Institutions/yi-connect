/**
 * Canonical result shape for ALL Yi Youth Academy server actions
 * (donor pattern: app/yi-future/actions/messages.ts). Actions never throw
 * for expected failures — they return { success: false, error } so callers
 * can render the explicit denial/error (never a silent redirect).
 */
export type ActionResult<T = void> =
  | { success: true; data: T; warning?: string }
  | { success: false; error: string };
