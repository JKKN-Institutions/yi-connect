/**
 * Yi Youth Academy — shared constants.
 * Lives in lib/ (NEVER in a "use server" file — async-only export rule).
 * Spec: docs/yi-youth-academy-spec.md
 */

export const YUVA_APP = "yuva" as const;

// Role strings in yi_directory.role_assignments (app = 'yuva')
export const ROLE_SUPER_ADMIN = "yuva_super_admin" as const;
export const ROLE_ADMIN = "yuva_admin" as const;
export const ROLE_CHAPTER_ADMIN = "chapter_admin" as const;
export const ROLE_INSTITUTION_COORDINATOR = "institution_coordinator" as const;
export const ROLE_MENTOR = "mentor" as const;

// Student session cookie (signed JSON, path-scoped — see lib/yuva/auth/student-session.ts)
export const YUVA_SESSION_COOKIE = "yuva_session" as const;
export const YUVA_SESSION_MAX_AGE_HOURS = 24;

// Program categories — the 7 from the national Program Creation Template (2026-06-10)
export const PROGRAM_CATEGORIES = [
  "entrepreneurship",
  "innovation",
  "learning",
  "accessibility",
  "climate_change",
  "health",
  "road_safety",
] as const;
export type ProgramCategory = (typeof PROGRAM_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ProgramCategory, string> = {
  entrepreneurship: "Entrepreneurship",
  innovation: "Innovation",
  learning: "Learning",
  accessibility: "Accessibility",
  climate_change: "Climate Change",
  health: "Health",
  road_safety: "Road Safety",
};

// Run lifecycle (validated transitions live in lib/yuva/run-machine.ts)
export const RUN_STATUSES = [
  "draft",
  "published",
  "applications_closed",
  "in_progress",
  "completed",
  "certified",
  "cancelled",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  draft: "Draft",
  published: "Published",
  applications_closed: "Applications closed",
  in_progress: "In progress",
  completed: "Completed",
  certified: "Certified",
  cancelled: "Cancelled",
};

// Cohort capacity (space norm 30–50 seats; SOFT cap — warning, never a block)
export const CAPACITY_DEFAULT = 50;

// Certificate eligibility default: ≥75% attendance (chapter can override per student)
export const CERT_ATTENDANCE_DEFAULT = 75;

// Per-session student work: late = submitted after session date + grace window
export const SUBMISSION_GRACE_DAYS = 7;

// Sender for academy notification emails (durable queue → Resend)
export const EMAIL_FROM =
  process.env.FROM_EMAIL ?? "Yi Youth Academy <noreply@yi-connect.app>";
