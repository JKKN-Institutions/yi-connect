/**
 * YIQ shared constants. Plain module (NOT "use server") so non-async exports
 * are legal — a "use server" file may only export async functions.
 */

export const YIQ_BRAND = {
  name: "YIQ",
  fullName: "Young Indians Quiz",
  tagline: "India. Innovation. Intellect.",
  promise: "India's Brightest Minds. One National Stage.",
  // Literal hex values — per-vertical globals.css files in this repo are
  // imported nowhere, so brand CSS tokens are dead. Use literals.
  navy: "#0B1B3A",
  saffron: "#F0A03C",
  green: "#1E7A4C",
  ink: "#101828",
  paper: "#FBFAF7",
} as const;

export type YiqCategory = "junior" | "senior";

export const CATEGORIES: {
  value: YiqCategory;
  label: string;
  classes: number[];
  blurb: string;
}[] = [
  { value: "junior", label: "Junior", classes: [9, 10], blurb: "Classes 9 & 10" },
  { value: "senior", label: "Senior", classes: [11, 12], blurb: "Classes 11 & 12" },
];

export function categoryForClass(classLevel: number): YiqCategory | null {
  if (classLevel === 9 || classLevel === 10) return "junior";
  if (classLevel === 11 || classLevel === 12) return "senior";
  return null;
}

export function categoryLabel(c: YiqCategory): string {
  return CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

/** Team size rules (Director decision 2026-08-24: teams register upfront). */
export const TEAM_MIN_MEMBERS = 2;
export const TEAM_MAX_MEMBERS = 3;

export const SCHOOL_TYPES = [
  { value: "government", label: "Government" },
  { value: "private", label: "Private" },
  { value: "aided", label: "Government Aided" },
  { value: "international", label: "International" },
  { value: "other", label: "Other" },
] as const;

/** Live-finals round formats — deck slide 12 (BQC-style structure). */
export const FINALS_ROUND_FORMATS = [
  {
    type: "direct",
    name: "Direct Questions",
    rule: "10 pts each · No passing · Tests core knowledge",
    pointsCorrect: 10,
    pointsPassBonus: 0,
  },
  {
    type: "pass_on",
    name: "Pass-On Round",
    rule: "10 pts if answered · 5 pts bonus on pass · Tests teamwork",
    pointsCorrect: 10,
    pointsPassBonus: 5,
  },
  {
    type: "visual",
    name: "Visual Round",
    rule: "Logos, Monuments, Leaders, Maps, Scientific Discoveries",
    pointsCorrect: 10,
    pointsPassBonus: 5,
  },
  {
    type: "audio",
    name: "Audio Round",
    rule: "National Songs, Speeches, Instruments, Historical Voices",
    pointsCorrect: 10,
    pointsPassBonus: 5,
  },
  {
    type: "rapid_fire",
    name: "Rapid Fire",
    rule: "60 seconds · 10 questions · Speed + accuracy",
    pointsCorrect: 10,
    pointsPassBonus: 0,
    timeLimitSeconds: 60,
    questionsPerTeam: 10,
  },
  {
    type: "india_challenge",
    name: "India Challenge",
    rule: "High difficulty · Constitution + Current Affairs + Innovation",
    pointsCorrect: 10,
    pointsPassBonus: 5,
  },
] as const;

export const CHAPTER_EVENT_STATUSES = [
  "draft",
  "registration_open",
  "registration_closed",
  "online_round_live",
  "online_round_closed",
  "finals_scheduled",
  "finals_live",
  "finals_complete",
] as const;

export type ChapterEventStatus = (typeof CHAPTER_EVENT_STATUSES)[number];

export const STATUS_LABELS: Record<ChapterEventStatus, string> = {
  draft: "Draft",
  registration_open: "Registration open",
  registration_closed: "Registration closed",
  online_round_live: "Online round live",
  online_round_closed: "Online round closed",
  finals_scheduled: "Finals scheduled",
  finals_live: "Finals live",
  finals_complete: "Finals complete",
};
