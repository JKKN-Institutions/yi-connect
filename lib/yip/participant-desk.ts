// Maps a participant's parliament_role + committee_name to their "primary desk"
// — the single place that role most needs to reach during a live session. Used
// by the participant bottom nav (app/yip/me/_components/participant-bottom-nav).
//
// Mirrors the role → desk-card logic in app/yip/me/page.tsx (isPresiding /
// isMinistryDesk / isPMDesk / isShadowDesk / isOpposition / isCommitteeMember).
// Pure data — safe to import from both the server layout and the client nav.

export type DeskKey =
  | "committee"
  | "speaker"
  | "pm"
  | "ministry"
  | "shadow"
  | "opposition";

export interface PrimaryDesk {
  key: DeskKey;
  href: string;
  label: string;
}

/**
 * Returns the participant's primary desk, or null when they have neither a
 * leadership role nor a committee (rare — the bottom nav then omits the Desk
 * tab rather than pointing it at an empty page).
 */
export function getPrimaryDesk(
  role: string | null | undefined,
  committeeName: string | null | undefined,
): PrimaryDesk | null {
  switch (role) {
    case "speaker":
    case "deputy_speaker":
      return { key: "speaker", href: "/yip/me/speaker", label: "My Desk" };
    case "prime_minister":
    case "deputy_prime_minister":
      return { key: "pm", href: "/yip/me/pm", label: "My Desk" };
    case "cabinet_minister":
      return { key: "ministry", href: "/yip/me/ministry", label: "My Desk" };
    case "shadow_minister":
      return { key: "shadow", href: "/yip/me/shadow", label: "My Desk" };
    case "leader_of_opposition":
      return { key: "opposition", href: "/yip/me/opposition", label: "My Desk" };
    default:
      // Almost everyone else is a committee member (committee_name present).
      if (committeeName) {
        return { key: "committee", href: "/yip/me/committee", label: "Committee" };
      }
      return null;
  }
}
