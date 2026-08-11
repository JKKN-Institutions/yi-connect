// "Is this person a PLATFORM admin?" for Yi-Future.
//
// Backs the Platform badge and the Promote/Demote platform buttons on
// /yi-future/national/admin/admins, plus the chapter switcher
// (chapter-context.ts, admin-chapter.ts).
//
// Deliberately NOT resolveFutureAccess().isNational: that is 13 accounts —
// every future_admin and future_super_admin — whereas the platform tier is 3
// (director, piyush.garg, vedant as of 2026-08-11). Standing inside another
// chapter as its admin is a platform-operator capability, not something the
// whole Yi national team needs.
//
// SOURCE (2026-08-11): yi_directory.role_assignments, app='future',
// role='platform_admin'. Previously this read yi.national_admins
// .is_platform_admin. That column and this role already listed the SAME three
// people — the legacy header comment claiming vedant@wrs.energy "holds no
// qualifying yi_directory role" was stale; vedant holds future:platform_admin.
// The only reason the two sources looked different is that director's and
// piyush's future:platform_admin rows sat is_active = false. The
// accompanying migration activates those two rows, which is why the tier is
// still exactly 3 people after the repoint.
//
// The property the old comment was protecting is intact and now stronger:
// this reads the same rows the badge renders and the buttons write, so
// Demote still has no second place to remember — and after the repoint there
// is no second place at all, because every Yi-Future gate resolves here.

import { isFuturePlatformOperator } from "@/lib/yi-future/auth/admin-source";

export async function isPlatformAdminEmail(
  email: string | null | undefined
): Promise<boolean> {
  // Fail closed: unknown email, no directory person, or no active role.
  return isFuturePlatformOperator(email);
}
