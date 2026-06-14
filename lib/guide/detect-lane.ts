import "server-only";

/**
 * Smart Guide — lane detection for the Yi Connect main dashboard (Adapter C).
 *
 * The guide is "smart" because it opens on the viewer's OWN lane. This is the
 * only per-app code. It reads the dashboard's existing role source
 * (getUserProfile → roles[].role_name from the get_user_roles_detailed RPC),
 * maps the role to one of the 5 lanes, and scopes which OTHER lanes the viewer
 * may switch to — failing CLOSED (an unknown level denies a gated lane).
 *
 * Shared by the full page (app/(dashboard)/user-guide/page.tsx) AND the layout
 * (for the Help FAB), so detection lives in exactly one place.
 */
import { getUserProfile } from "@/lib/auth";
import { GUIDE_PERSONAS, type GuidePersona } from "@/lib/guide/types";
import { GUIDES, REQUIRES } from "@/lib/guide/content";

export type DetectedLane = {
  /** The viewer's own lane — the default view. */
  persona: GuidePersona;
  /** Scope id for `:scopeId` deep-links — the dashboard guide has none. */
  scopeId: string | null;
  /** Lanes the viewer may switch to (permission-scoped). */
  visible: GuidePersona[];
  /** True when there is genuinely nothing to show → explicit no-access state. */
  denied: boolean;
};

/**
 * Dashboard role name → a coarse level, used ONLY for the gated-lane `can()`
 * check. The persona a viewer SEES is decided by name in roleToPersona; this
 * level just answers "may they also open the Leadership / National lanes?".
 */
const LEVEL_BY_ROLE: Record<string, number> = {
  "Super Admin": 7,
  "National Admin": 6,
  Chair: 4,
  "Co-Chair": 4,
  "Executive Member": 3,
  "EC Member": 3,
  "Vertical Head": 3,
  Coordinator: 2,
};

const LEAD_LEVEL = 4; // Chair / Co-Chair and above
const NATIONAL_LEVEL = 6; // National Admin / Super Admin

/** Pick the viewer's home lane from their role names (highest authority wins). */
function roleToPersona(roleNames: string[]): GuidePersona | null {
  const has = (r: string) => roleNames.includes(r);
  if (has("National Admin") || has("Super Admin")) return "national";
  if (has("Chair") || has("Co-Chair")) return "leadership";
  if (has("Vertical Head")) return "vertical_head";
  if (has("Coordinator")) return "coordinator";
  if (roleNames.length > 0) return "member"; // Executive / EC / any other → member
  return null;
}

export async function detectLane(): Promise<DetectedLane> {
  const profile = await getUserProfile();
  const roleNames: string[] = Array.isArray(profile?.roles)
    ? profile.roles.map((r: { role_name?: string }) => r.role_name ?? "").filter(Boolean)
    : [];

  // Any logged-in dashboard user is at least a chapter member (the dashboard
  // layout already gates non-members out), so an authed viewer with no named
  // role still gets the open Member lane. No profile → no foothold.
  const primaryPersona: GuidePersona | null = profile ? roleToPersona(roleNames) ?? "member" : null;

  const level = roleNames.reduce(
    (max, name) => Math.max(max, LEVEL_BY_ROLE[name] ?? 1),
    profile ? 1 : 0
  );
  const isSuperAdmin = level >= NATIONAL_LEVEL; // National / Super see every lane

  // Fail CLOSED: an unknown permission key denies.
  const can = (key: string): boolean =>
    key === REQUIRES.lead ? level >= LEAD_LEVEL : key === REQUIRES.national ? level >= NATIONAL_LEVEL : false;

  const hasFoothold = primaryPersona != null || isSuperAdmin;

  // A gated lane (one with `requires`) shows only to super-admins, the viewer's
  // own persona, or a viewer who can() it. Open lanes (no `requires`) show to all.
  const visible = GUIDE_PERSONAS.filter((p) => {
    const req = GUIDES.lanes[p].requires;
    return isSuperAdmin || (hasFoothold && p === primaryPersona) || !req || (hasFoothold && can(req));
  });

  // Never render a lane outside `visible`.
  const own: GuidePersona =
    (primaryPersona && visible.includes(primaryPersona) ? primaryPersona : visible[0]) ?? GUIDE_PERSONAS[0];

  return { persona: own, scopeId: null, visible, denied: visible.length === 0 };
}
