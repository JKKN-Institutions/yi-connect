/**
 * Chapter desk — payload shapes and the one nomination validator. Pure: no
 * server-only imports, so the wizard (browser) and the server action run
 * the exact same rules. The server never trusts the browser's verdict.
 */
import { WORDS } from "@/lib/recognitions/constants";
import { countWords } from "@/lib/recognitions/words";

export type NominationForm = {
  awardId: string;
  /** Section A — always exactly five entries. */
  reasons: string[];
  /** Section B — one flagship event: name & impact. */
  flagship: string;
  /** Section C. */
  hosted: boolean;
  hostedName: string;
  hostedType: "national" | "regional" | "";
  /** Section D. */
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
    reasons: ["", "", "", "", ""],
    flagship: "",
    hosted: false,
    hostedName: "",
    hostedType: "",
    announcement: "",
  };
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
    reasons: reasons.slice(0, 5),
    flagship: str(r.flagship),
    hosted: r.hosted === true,
    hostedName: str(r.hostedName),
    hostedType,
    announcement: str(r.announcement),
  };
}

/**
 * Problems with one nomination, as plain sentences. A draft may be partial
 * but never over a word limit; a submission must be complete.
 */
export function validateNomination(f: NominationForm, opts: { forSubmit: boolean }): string[] {
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
