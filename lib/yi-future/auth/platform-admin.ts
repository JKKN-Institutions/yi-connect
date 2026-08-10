// "Is this person a PLATFORM admin?" for Yi-Future.
//
// Reads yi.national_admins.is_platform_admin — the exact column the Platform
// badge and the Promote/Demote platform buttons on
// /yi-future/national/admin/admins display and write. Demoting someone there
// removes their platform capability immediately, with no second place to
// remember.
//
// Deliberately NOT resolveFutureAccess().isNational: that is 13 accounts —
// every future_admin and future_super_admin — whereas the platform tier is 3
// (director, piyush.garg, vedant as of 2026-08-10). Standing inside another
// chapter as its admin is a platform-operator capability, not something the
// whole Yi national team needs.
//
// Deliberately NOT hasYiFuturePlatformTier() in actions/national-admins.ts
// either: that one derives the tier from yi_directory role_assignments, and it
// has already drifted from the badge — vedant@wrs.energy carries
// is_platform_admin in yi.national_admins but holds no qualifying yi_directory
// role. Gating on the column the director can actually see and change is the
// one that cannot silently disagree with the screen.
//
// (Project rule says yi_directory is the mother source and yi.national_admins
// is legacy to be deprecated. When that migration happens, this function is
// the single place to repoint — that is why it is a function and not an
// inline query.)

import { createServiceClient } from "@/lib/yi-future/supabase/server";

export async function isPlatformAdminEmail(
  email: string | null | undefined
): Promise<boolean> {
  const clean = email?.trim().toLowerCase();
  if (!clean) return false;

  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("national_admins")
    .select("is_platform_admin")
    .eq("email", clean)
    .maybeSingle();

  // Fail closed: no row, or the flag unset, is not a platform admin.
  return (data as { is_platform_admin: boolean | null } | null)
    ?.is_platform_admin === true;
}
