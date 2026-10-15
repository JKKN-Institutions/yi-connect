/**
 * Chapter desk — payload shapes and the one nomination validator. Pure: no
 * server-only imports, so the wizard (browser) and the server action run
 * the exact same rules. The server never trusts the browser's verdict.
 */
import { JUSTIFICATION_MAX_CHARS, WORDS } from "@/lib/recognitions/constants";
import { countWords } from "@/lib/recognitions/words";
import type { NominationRow } from "@/lib/recognitions/types";

export type NominationForm = {
  awardId: string;
  /**
   * 2026 (recognitions_04): the chapter's "Why should your chapter get this
   * recognition?", up to WORDS.justification words. The only thing a new
   * nomination asks for.
   */
  justification: string;
  /**
   * The older form (before recognitions_04). New nominations write these as
   * empty values so the database checks hold; they are read only to show,
   * or fix, a nomination filed on the old form.
   */
  reasons: string[];
  flagship: string;
  hosted: boolean;
  hostedName: string;
  hostedType: "national" | "regional" | "";
  announcement: string;
};

export type PredictionPick = {
  awardId: string;
  category: "pioneers" | "trailblazers" | "sparks";
  predictedChapterId: string;
};

export function emptyForm(awardId: string): NominationForm {
  return {
    awardId,
    justification: "",
    reasons: ["", "", "", "", ""],
    flagship: "",
    hosted: false,
    hostedName: "",
    hostedType: "",
    announcement: "",
  };
}

/**
 * True when the form holds the OLD sections (filed before recognitions_04)
 * and no "why". Such a nomination is shown, and fixed, with the old sections.
 */
export function isLegacyForm(f: NominationForm): boolean {
  if (f.justification.trim() !== "") return false;
  return (
    f.reasons.some((r) => r.trim() !== "") ||
    f.flagship.trim() !== "" ||
    f.hosted ||
    f.announcement.trim() !== ""
  );
}

/** A stored nomination as a form (old rows keep their old sections). */
export function formFromRow(n: NominationRow): NominationForm {
  const reasons = [...(n.reasons ?? [])];
  while (reasons.length < 5) reasons.push("");
  return {
    awardId: n.award_id,
    justification: n.justification ?? "",
    reasons: reasons.slice(0, 5),
    flagship: n.flagship_event ?? "",
    hosted: n.hosted_event,
    hostedName: n.hosted_event_name ?? "",
    hostedType: n.hosted_event_type ?? "",
    announcement: n.announcement_draft ?? "",
  };
}

/** Keep only the "why": what a new nomination writes (the old sections go in empty). */
export function whyOnly(f: NominationForm): NominationForm {
  return { ...emptyForm(f.awardId), justification: f.justification };
}

/** Coerce whatever arrived over the wire into a well-formed form. */
export function cleanForm(raw: unknown): NominationForm | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.awardId !== "string" || r.awardId === "") return null;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const reasons = Array.isArray(r.reasons) ? r.reasons.map(str) : [];
  while (reasons.length < 5) reasons.push("");
  const hostedType = r.hostedType === "national" || r.hostedType === "regional" ? r.hostedType : "";
  return {
    awardId: r.awardId,
    justification: str(r.justification),
    reasons: reasons.slice(0, 5),
    flagship: str(r.flagship),
    hosted: r.hosted === true,
    hostedName: str(r.hostedName),
    hostedType,
    announcement: str(r.announcement),
  };
}

/** Problems with the "why" alone, as plain sentences. */
export function validateWhy(text: string, opts: { forSubmit: boolean }): string[] {
  const words = countWords(text);
  if (words > WORDS.justification) {
    return [`Your answer is ${words} words. Keep it to ${WORDS.justification} words or fewer.`];
  }
  if (text.trim().length > JUSTIFICATION_MAX_CHARS) {
    return [`Your answer is too long. Keep it under ${JUSTIFICATION_MAX_CHARS} characters.`];
  }
  if (opts.forSubmit && text.trim() === "") {
    return ["Write why your chapter should get this recognition. It can't be left empty."];
  }
  return [];
}

/**
 * Problems with one nomination, as plain sentences. A draft may be partial
 * but never over a limit; a submission must be complete.
 *   legacy false (every new nomination): only the "why" is asked for.
 *   legacy true: a nomination on the OLD form, being fixed after a send-back.
 */
export function validateNomination(f: NominationForm, opts: { forSubmit: boolean; legacy?: boolean }): string[] {
  if (!opts.legacy) return validateWhy(f.justification, opts);
  const problems: string[] = [];
  f.reasons.forEach((r, i) => {
    if (countWords(r) > WORDS.nominationReason) {
      problems.push(`Reason ${i + 1} is over ${WORDS.nominationReason} words.`);
    } else if (opts.forSubmit && r.trim() === "") {
      problems.push(`Reason ${i + 1} is empty.`);
    }
  });
  if (countWords(f.flagship) > WORDS.flagshipEvent) {
    problems.push(`The flagship event is over ${WORDS.flagshipEvent} words.`);
  } else if (opts.forSubmit && f.flagship.trim() === "") {
    problems.push("The flagship event is empty.");
  }
  if (opts.forSubmit && f.hosted) {
    if (f.hostedName.trim() === "") problems.push("Name the national or regional event you hosted.");
    if (f.hostedType === "") problems.push("Say whether the hosted event was national or regional.");
  }
  if (countWords(f.announcement) > WORDS.announcementDraft) {
    problems.push(`The announcement draft is over ${WORDS.announcementDraft} words.`);
  } else if (opts.forSubmit && f.announcement.trim() === "") {
    problems.push("The announcement draft is empty.");
  }
  return problems;
}

/** The chapter the page is about: ?chapter=<id> if given, else the first one. */
export function pickChapterId(chapters: Array<{ id: string }>, param: string | string[] | undefined): string {
  if (typeof param === "string" && param !== "") return param;
  return chapters[0]?.id ?? "";
}

export function withChapter(path: string, chapterId: string, chapterCount: number): string {
  return chapterCount > 1 ? `${path}?chapter=${encodeURIComponent(chapterId)}` : path;
}
