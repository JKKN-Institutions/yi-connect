/**
 * Registration types + pure validation. Deliberately NOT in the "use server"
 * action file — that file may export only async functions, so every type and
 * constant for this flow lives here.
 */

import { categoryForClass, TEAM_MAX_MEMBERS, TEAM_MIN_MEMBERS } from "./constants";

export const REGISTRATIONS_PER_IP_PER_HOUR = 10;
export const MAX_TEAMS_PER_SCHOOL_PER_CATEGORY = 3;

export type RegisterMemberInput = {
  fullName: string;
  classLevel: number;
  section?: string;
  email?: string;
  phone?: string;
};

export type RegisterTeamInput = {
  chapterEventId: string;
  schoolName: string;
  schoolType: "government" | "private" | "aided" | "international" | "other";
  board?: string;
  city?: string;
  district?: string;
  state?: string;
  principalName?: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  teamName: string;
  members: RegisterMemberInput[];
  /** Honeypot — must stay empty. */
  website?: string;
};

export type RegisteredMember = {
  name: string;
  classLevel: number;
  accessCode: string;
};

export type RegisterTeamResult =
  | {
      success: true;
      teamCode: string;
      members: RegisteredMember[];
      teamName?: string;
      schoolName?: string;
      category?: "junior" | "senior";
      chapterName?: string;
    }
  | { success: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[6-9]\d{9}$/;

/**
 * Returns an error string, or null when the input is valid.
 *
 * The category rule is the important one: every member of a team must sit in
 * the SAME category, because Junior and Senior are separate championships and
 * a team's score is the average of its members. A mixed team would be scoring
 * across two competitions at once.
 */
export function validateRegistration(i: RegisterTeamInput): string | null {
  if (!i.chapterEventId) return "Choose your Yi chapter.";
  if (!i.schoolName?.trim() || i.schoolName.trim().length < 3)
    return "Enter your school's full name.";
  if (i.schoolName.trim().length > 160) return "That school name is too long.";
  if (!i.teamName?.trim() || i.teamName.trim().length < 2)
    return "Give your team a name.";
  if (i.teamName.trim().length > 80) return "That team name is too long.";
  if (!i.contactPerson?.trim()) return "Enter the teacher's name.";
  if (!EMAIL.test(i.contactEmail?.trim() ?? ""))
    return "Enter a valid contact email address.";
  if (!PHONE.test((i.contactPhone ?? "").replace(/[\s+]|^91/g, "")))
    return "Enter a valid 10-digit mobile number.";

  const members = i.members ?? [];
  if (members.length < TEAM_MIN_MEMBERS)
    return `A team needs at least ${TEAM_MIN_MEMBERS} members.`;
  if (members.length > TEAM_MAX_MEMBERS)
    return `A team can have at most ${TEAM_MAX_MEMBERS} members.`;

  const categories = new Set<string>();
  for (const m of members) {
    if (!m.fullName?.trim() || m.fullName.trim().length < 2)
      return "Every team member needs a full name.";
    if (m.fullName.trim().length > 120) return "That student name is too long.";
    const cat = categoryForClass(m.classLevel);
    if (!cat) return "Team members must be in Classes 9 to 12.";
    categories.add(cat);
    if (m.email && !EMAIL.test(m.email.trim()))
      return `Check the email address for ${m.fullName.trim()}.`;
  }

  if (categories.size > 1)
    return "All team members must be in the same category — Junior (Classes 9–10) or Senior (Classes 11–12). Register two separate teams instead.";

  const names = members.map((m) => m.fullName.trim().toLowerCase());
  if (new Set(names).size !== names.length)
    return "Two team members have the same name. Please check.";

  return null;
}
