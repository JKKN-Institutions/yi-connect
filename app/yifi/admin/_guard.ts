import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/yifi/supabase/server";

export type AdminContext = {
  email: string;
  editionId: string;
  permissions: string[];
};

/**
 * Server-component guard for every /yifi/admin/* sub-page.
 *
 * - Redirects to /yifi/login if there is no Supabase session.
 * - Redirects to /yifi/admin if there is no active edition.
 * - Returns the caller's email, the active edition id, and the flattened
 *   set of permission keys granted by their organiser role(s).
 *
 * Pages call hasPermission(ctx.permissions, "<key>") and render <AccessDenied>
 * (NOT a silent redirect) when the key is missing — see rule #27.
 */
export async function getAdminContext(): Promise<AdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/yifi/login");

  const svc = await createServiceClient();

  const { data: edition } = await svc.rpc("yifi_current_edition");
  const editionId = edition?.id;
  if (!editionId) redirect("/yifi/admin");

  const { data: roles } = await svc.rpc("yifi_check_organiser", {
    p_email: user.email,
    p_edition_id: editionId,
  });

  const permissions = Array.isArray(roles)
    ? [...new Set(roles.flatMap((r: { permissions?: string[] }) => r.permissions || []))]
    : [];

  return { email: user.email, editionId, permissions };
}

/** Super admin ("*") sees everything; otherwise the exact key must be present. */
export function hasPermission(permissions: string[], key: string): boolean {
  return permissions.includes("*") || permissions.includes(key);
}
