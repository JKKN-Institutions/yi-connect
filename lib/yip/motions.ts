// Handbook-derived metadata for the 7 parliamentary motion types.
// Used in UI labels, tooltips, and filtering. No "use server" — shared.

export type MotionType =
  | "adjournment"
  | "calling_attention"
  | "breach_of_privilege"
  | "no_confidence"
  | "short_duration"
  | "obituary"
  | "laying_of_papers"
  | "point_of_order"
  | "impeach_speaker";

export type MotionStatus =
  | "submitted"
  | "admitted"
  | "rejected"
  | "discussing"
  | "voting"
  | "resolved"
  | "deferred";

export const MOTION_TYPES: {
  code: MotionType;
  label: string;
  description: string;
  handbookPage: number;
  goesToVote: boolean;
  needsMinistry: boolean;
  color: string;
}[] = [
  {
    code: "adjournment",
    label: "Adjournment Motion",
    description: "Raised to pause regular business to discuss an urgent national issue. Requires Speaker's approval.",
    handbookPage: 24,
    goesToVote: false,
    needsMinistry: true,
    color: "bg-amber-500",
  },
  {
    code: "calling_attention",
    label: "Calling Attention Notice",
    description: "Used to raise urgent public issues. Minister must respond immediately.",
    handbookPage: 23,
    goesToVote: false,
    needsMinistry: true,
    color: "bg-cyan-500",
  },
  {
    code: "breach_of_privilege",
    label: "Breach of Privilege",
    description: "Raised when a member's parliamentary rights are violated. Speaker decides further action.",
    handbookPage: 23,
    goesToVote: false,
    needsMinistry: false,
    color: "bg-rose-500",
  },
  {
    code: "no_confidence",
    label: "No-Confidence Motion",
    description: "Opposition challenges the Government. House votes — if passed, Government must resign.",
    handbookPage: 24,
    goesToVote: true,
    needsMinistry: false,
    color: "bg-red-600",
  },
  {
    code: "short_duration",
    label: "Short Duration Discussion",
    description: "Topic-based discussion without formal voting. Encourages broader participation.",
    handbookPage: 24,
    goesToVote: false,
    needsMinistry: true,
    color: "bg-violet-500",
  },
  {
    code: "obituary",
    label: "Obituary Reference",
    description: "Tribute to a notable personality — Speaker leads a moment of silence.",
    handbookPage: 23,
    goesToVote: false,
    needsMinistry: false,
    color: "bg-slate-500",
  },
  {
    code: "laying_of_papers",
    label: "Laying of Papers",
    description: "Ministers present reports, policies, or official documents (budgets, committee reports, white papers).",
    handbookPage: 23,
    goesToVote: false,
    needsMinistry: true,
    color: "bg-indigo-500",
  },
  {
    code: "point_of_order",
    label: "Point of Order",
    description: "Raised when House procedure or rules are being broken. No vote — the Speaker rules on it immediately.",
    handbookPage: 23,
    goesToVote: false,
    needsMinistry: false,
    color: "bg-teal-500",
  },
  {
    code: "impeach_speaker",
    label: "Impeach the Speaker",
    description: "Challenges the conduct of the sitting Speaker. The whole House votes — if passed, the Speaker (and Deputy) are removed and the House elects a new Speaker.",
    handbookPage: 24,
    goesToVote: true,
    needsMinistry: false,
    color: "bg-fuchsia-600",
  },
];

export function motionMeta(code: MotionType) {
  return MOTION_TYPES.find((m) => m.code === code)!;
}

export const MOTION_STATUS_LABELS: Record<MotionStatus, string> = {
  submitted: "Awaiting Speaker",
  admitted: "Admitted",
  rejected: "Rejected",
  discussing: "Under Discussion",
  voting: "Voting Open",
  resolved: "Resolved",
  deferred: "Deferred",
};

export const MOTION_STATUS_COLORS: Record<MotionStatus, string> = {
  submitted: "bg-gray-100 text-gray-700 border-gray-200",
  admitted: "bg-blue-100 text-blue-700 border-blue-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  discussing: "bg-amber-100 text-amber-700 border-amber-200",
  voting: "bg-violet-100 text-violet-700 border-violet-200",
  resolved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  deferred: "bg-slate-100 text-slate-700 border-slate-200",
};
