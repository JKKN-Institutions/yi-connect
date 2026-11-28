import 'server-only';

/**
 * Who may use the chapter WhatsApp account (send, connect, disconnect, see the
 * linking QR code). Server-side check — never trust the page guard alone.
 *
 * Allowed:
 * - Yi Connect leadership roles: the roles the WhatsApp pages
 *   (app/(dashboard)/communications/whatsapp/**) allow, plus 'Executive
 *   Member', which the stakeholder / member-requests / dashboard pages that
 *   render the WhatsApp send buttons also allow.
 * - Yi Future platform admins (same predicate as requirePlatformAdmin), who
 *   link and use the shared number from /yi-future/national/admin.
 *
 * Fails closed and never redirects: returns a result the caller turns into a
 * 401/403 JSON response or a { success: false, error } action result.
 */

import { getCurrentUser } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { hasFuturePlatformTier } from '@/lib/yi-future/auth/admin-source';

export const WHATSAPP_SENDER_ROLES = [
  'Super Admin',
  'National Admin',
  'Executive Member',
  'Chair',
  'Co-Chair',
  'EC Member',
] as const;

export type WhatsAppAccess =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: string };

export async function getWhatsAppAccess(): Promise<WhatsAppAccess> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, status: 401, error: 'Unauthorized: Please log in' };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: roles, error } = await supabase
      .schema('yi_connect')
      .rpc('get_user_roles_detailed', { p_user_id: user.id });

    if (error) {
      console.error('[whatsapp-access] get_user_roles_detailed failed', {
        userId: user.id,
        code: error.code,
        message: error.message,
      });
    } else if (
      (roles as Array<{ role_name: string }> | null)?.some((r) =>
        (WHATSAPP_SENDER_ROLES as readonly string[]).includes(r.role_name)
      )
    ) {
      return { ok: true, userId: user.id };
    }

    if (await hasFuturePlatformTier(user.email)) {
      return { ok: true, userId: user.id };
    }
  } catch (err) {
    console.error('[whatsapp-access] role check failed', err);
  }

  return {
    ok: false,
    status: 403,
    error:
      "You don't have access to send WhatsApp messages. Contact your Chapter Chair.",
  };
}
