/**
 * YIP 2026 Branding Compliance Rules
 * -----------------------------------
 * Source of truth is the `branding_rules` DB table (seeded by migration 017
 * and editable at /dashboard/admin/branding-rules). This static catalogue is
 * kept as a defensive FALLBACK only — it is used when the DB query fails or
 * the table is empty (e.g. in a fresh environment where the seed has not yet
 * run) so the compliance checker keeps rendering instead of going blank.
 *
 * Primary handbook source: p.13 (Branding & Chapter Communications)
 * Secondary:               p.1 (cover logos), p.10 (photography briefing)
 *
 * Keep rule keys in sync with the migration-017 seed. Routine rule edits
 * should happen in the DB (admin UI), not here.
 */

export type BrandingCategory =
  | "logo"
  | "backdrop"
  | "collateral"
  | "fund"
  | "invitation"
  | "recognition";

export type BrandingSeverity = "blocker" | "warning" | "advisory";

export type BrandingRule = {
  /** Stable identifier, stored in DB. Never rename — only deprecate. */
  key: string;
  category: BrandingCategory;
  title: string;
  description: string;
  /** Handbook page where the rule is grounded. */
  handbook_page: number;
  /** Whether a photo / doc URL is expected for verification. */
  requires_evidence: boolean;
  /** Controls scoring + UI treatment. blocker = ship-stopper. */
  severity: BrandingSeverity;
};

export const BRANDING_RULES: readonly BrandingRule[] = [
  // ── Required logos (handbook cover p.1) ────────────────────────────
  {
    key: "yi_logo_present",
    category: "logo",
    title: "Yi logo on backdrop & key collaterals",
    description:
      "The Young Indians (Yi) logo must appear on the main session backdrop and on all official chapter collaterals (agenda, ID cards, certificates).",
    handbook_page: 1,
    requires_evidence: true,
    severity: "blocker",
  },
  {
    key: "cii_logo_present",
    category: "logo",
    title: "CII logo placed alongside Yi",
    description:
      "Yi operates under CII (Confederation of Indian Industry). The CII logo must accompany the Yi logo on all parent-org placements.",
    handbook_page: 1,
    requires_evidence: true,
    severity: "blocker",
  },
  {
    key: "thalir_logo_present",
    category: "logo",
    title: "Thalir logo on all school-program materials",
    description:
      "YIP is a Thalir (Yi's school program) initiative. The Thalir 'Let's Nurture from School' logo must be on the backdrop and student-facing materials.",
    handbook_page: 1,
    requires_evidence: true,
    severity: "blocker",
  },
  {
    key: "bharat_one_spirit_present",
    category: "logo",
    title: "'Bharat | One Spirit' mark on backdrop",
    description:
      "The Bharat | One Spirit mark shown on the handbook cover must be on the main session backdrop.",
    handbook_page: 1,
    requires_evidence: true,
    severity: "warning",
  },

  // ── Backdrop / stage (handbook p.13) ───────────────────────────────
  {
    key: "no_sponsor_logos_on_backdrop",
    category: "backdrop",
    title: "No sponsor logos on main session backdrop",
    description:
      "Sponsor logos are NOT permitted on the main session backdrop. Backdrop carries only Yi / CII / Thalir / Bharat | One Spirit and the YIP 2026 mark.",
    handbook_page: 13,
    requires_evidence: true,
    severity: "blocker",
  },
  {
    key: "backdrop_matches_national_design",
    category: "backdrop",
    title: "Backdrop artwork matches national template",
    description:
      "Chapter backdrop follows the dimensions, color palette, and typography supplied by the National Thalir design team. No freehand edits.",
    handbook_page: 13,
    requires_evidence: true,
    severity: "warning",
  },

  // ── Collaterals (handbook p.13) ────────────────────────────────────
  {
    key: "sponsor_logos_on_collateral_approved",
    category: "collateral",
    title: "Sponsor logos on collaterals are pre-approved",
    description:
      "Sponsor logos may appear on approved collaterals and creatives (not backdrop). Confirm each placement has national sign-off before print.",
    handbook_page: 13,
    requires_evidence: false,
    severity: "advisory",
  },
  {
    key: "consistent_branding_across_comms",
    category: "collateral",
    title: "Consistent branding across all chapter communications",
    description:
      "WhatsApp creatives, emails, LinkedIn posts, and printed agendas all use the same YIP 2026 branding lockup. No mixed templates.",
    handbook_page: 13,
    requires_evidence: false,
    severity: "warning",
  },

  // ── Fundraising (handbook p.13) ────────────────────────────────────
  {
    key: "thalir_branding_used_for_fundraising",
    category: "fund",
    title: "Funds raised under Thalir branding only",
    description:
      "All chapter fundraising pitches, sponsor decks, and invoices are branded THALIR — never YIP standalone. This is a CII compliance requirement.",
    handbook_page: 13,
    requires_evidence: true,
    severity: "blocker",
  },
  {
    key: "sponsor_mou_on_file",
    category: "fund",
    title: "Sponsor MoUs / LoAs on file before logo use",
    description:
      "Before any sponsor logo appears anywhere, a signed MoU or Letter of Agreement is on record at chapter level.",
    handbook_page: 13,
    requires_evidence: false,
    severity: "warning",
  },

  // ── Recognitions / certificates (handbook p.13) ────────────────────
  {
    key: "recognitions_match_national_designs",
    category: "recognition",
    title: "Certificates & mementos match national designs",
    description:
      "Print recognitions (certificates, mementos, trophies) exactly per the designs circulated by the National Thalir team. No chapter-level redesign.",
    handbook_page: 13,
    requires_evidence: true,
    severity: "warning",
  },

  // ── Invitations (handbook p.13) ────────────────────────────────────
  {
    key: "mp_cabinet_invitations_approved_by_national",
    category: "invitation",
    title: "MP / Cabinet invitations approved by National",
    description:
      "Every invitation to a sitting MP or Cabinet Minister is reviewed and approved by the National Thalir team BEFORE it leaves the chapter.",
    handbook_page: 13,
    requires_evidence: false,
    severity: "blocker",
  },
  {
    key: "dignitary_protocol_briefing_done",
    category: "invitation",
    title: "Chapter team briefed on dignitary protocol",
    description:
      "Chapter chair + event lead briefed on reception, seating, and addressing protocol for invited dignitaries (Hon'ble, Shri/Smt., salutations).",
    handbook_page: 13,
    requires_evidence: false,
    severity: "advisory",
  },

  // ── Photographer / media (handbook p.10 + p.13) ────────────────────
  {
    key: "photographer_briefed_on_branding",
    category: "collateral",
    title: "Photographer/videographer briefed on branding",
    description:
      "Media team knows which logos must be in-frame for hero shots (backdrop + podium) and the 'no sponsor on backdrop' rule so published photos stay compliant.",
    handbook_page: 10,
    requires_evidence: false,
    severity: "advisory",
  },
] as const;

export const BRANDING_CATEGORY_LABEL: Record<BrandingCategory, string> = {
  logo: "Logos",
  backdrop: "Backdrop & Stage",
  collateral: "Collaterals & Creatives",
  fund: "Fundraising & Sponsors",
  invitation: "Invitations & Dignitaries",
  recognition: "Recognitions",
};

export const BRANDING_CATEGORY_ORDER: BrandingCategory[] = [
  "logo",
  "backdrop",
  "collateral",
  "fund",
  "invitation",
  "recognition",
];

export function getBrandingRule(key: string): BrandingRule | undefined {
  return BRANDING_RULES.find((r) => r.key === key);
}

// ── Invitation categories (matches invitation_approvals.invitation_category)
export const INVITATION_CATEGORIES = [
  { value: "mp_cabinet", label: "MP / Cabinet Minister" },
  { value: "mla_state_gov", label: "MLA / State Government" },
  { value: "other", label: "Other Dignitary" },
] as const;

export type InvitationCategory = (typeof INVITATION_CATEGORIES)[number]["value"];
