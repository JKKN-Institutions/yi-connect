/**
 * Shadow-mode comparison for the can() permission gate (Phase 7 rollout).
 *
 * This is the SAFE enforcement-migration step: OBSERVE, don't enforce. We
 * compute `can(capability, target)` ALONGSIDE the existing legacy gate and log
 * only the DISAGREEMENTS. Nothing here changes behavior, nothing here throws —
 * the legacy gate remains the sole source of truth. Once the disagreement log
 * is clean (and the capability map is Director-approved), a later phase can flip
 * the gates over to `can()` with confidence that no verdict will silently move.
 *
 * Grep Vercel logs for `can_shadow` to see where the two gates diverge.
 *
 * Created 2026-05-31 — consolidation plan §4, §6 (Phase 7).
 */
import { can } from "@/lib/yi/auth/can";

/**
 * Compare the legacy gate's verdict against what `can()` would return, and log
 * a single line ONLY when they disagree. Fire-and-forget: callers `void` this.
 *
 * Wrapped in try/catch so it can NEVER throw and NEVER affect the caller — a
 * failure to compute the shadow verdict is silently swallowed (this is purely
 * observational; a broken observer must not break the real gate).
 *
 * @param gate          name of the legacy gate firing the comparison (e.g. 'require_super_admin')
 * @param legacyAllowed the verdict the legacy gate actually returned (source of truth)
 * @param capability    dotted capability to evaluate via can() (e.g. 'event.delete')
 * @param target        where the action lands: app + optional chapter/zone scope
 */
export async function shadowCompare(
  gate: string,
  legacyAllowed: boolean,
  capability: string,
  target: { app: string; chapter?: string | null; zone?: string | null }
): Promise<void> {
  try {
    const canResult = await can(capability, target);
    if (canResult !== legacyAllowed) {
      // Single-line JSON so Vercel log search can filter on the `tag` field.
      console.log(
        JSON.stringify({
          tag: "can_shadow",
          gate,
          legacyAllowed,
          canAllowed: canResult,
          capability,
          target,
        })
      );
    }
  } catch {
    // Observational only — never let the shadow comparison affect the caller.
  }
}
