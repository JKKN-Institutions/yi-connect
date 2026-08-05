"use server";

import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { createServiceClient } from "@/lib/yip/supabase/server";
import {
  buildNationalAttendanceCsv,
  type AttendanceQueryable,
  type NationalAttendanceExport,
} from "@/lib/yip/national-attendance";

// ═══════════════════════════════════════════════════════════════════════
// Gated wrapper around the national attendance CSV build.
//
// PLATFORM master data (spans every event, not one) → requireSuperAdmin(),
// NOT getYipEventAccess. Fails CLOSED: no gate, no rows. All the reading and
// CSV assembly lives in lib/yip/national-attendance.ts so it stays testable
// without minting a super-admin session.
// ═══════════════════════════════════════════════════════════════════════

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Every delegate across every real chapter round, with Day 1 / Day 2 check-in.
 *
 * Read-only. Re-runnable any time — re-download to pick up late check-ins.
 */
export async function exportNationalAttendance(): Promise<
  ActionResult<NationalAttendanceExport>
> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) {
    return {
      success: false,
      error:
        "Only the national team can download the all-chapter attendance file.",
    };
  }

  const service = await createServiceClient();
  // Cast: see AttendanceQueryable — structural matching against Supabase's
  // generic builder overflows tsc's instantiation depth (TS2589).
  return buildNationalAttendanceCsv(
    service as unknown as AttendanceQueryable
  );
}
