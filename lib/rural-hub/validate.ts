/**
 * Turns the posted form into a row, or a reason it was refused.
 *
 * The browser limits how many boxes can be ticked, but that is UX only: this
 * re-checks every answer against the question list, so the stored data can
 * only ever hold real option keys, within each question's limit.
 */
import { PANCHAYATS, QUESTIONS } from "./anumanpalli-survey";

export type FeedbackRow = {
  respondent_name: string;
  panchayat: string;
  /** Ten-digit Indian mobile number, digits only (see normalizePhone). */
  phone: string;
  answers: Record<string, string | string[]>;
  comment: string | null;
};

/**
 * The phone is the person's identity on this form: a second send from the same
 * phone replaces the first (Director, 9 Nov 2026). So every way of writing one
 * number must land on the same ten digits: "+91 98765 43210", "098765 43210" and
 * "9876543210" are one person. Returns null if it is not an Indian mobile.
 */
export function normalizePhone(raw: string): string | null {
  if (!/^[0-9+ ()-]{10,20}$/.test(raw)) return null;
  let d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9][0-9]{9}$/.test(d) ? d : null;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export function parseFeedback(
  fd: FormData
): { ok: true; row: FeedbackRow } | { ok: false; error: string } {
  const name = str(fd, "respondent_name");
  if (!name) return { ok: false, error: "Please write your name. · பெயர்" };
  if (name.length > 120) return { ok: false, error: "Name is too long." };

  const panchayat = str(fd, "panchayat");
  if (!PANCHAYATS.some((p) => p.key === panchayat)) {
    return { ok: false, error: "Please choose your panchayat. · உங்கள் ஊராட்சி" };
  }

  const phoneRaw = str(fd, "phone");
  if (!phoneRaw) {
    return { ok: false, error: "Please write your phone number. · தொலைபேசி" };
  }
  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    return { ok: false, error: "Please check the phone number: 10 digits. · தொலைபேசி" };
  }

  const answers: Record<string, string | string[]> = {};
  for (const q of QUESTIONS) {
    const allowed = new Set(q.options.map((o) => o.key));
    if (q.kind === "multi") {
      const picked = [...new Set(fd.getAll(q.key).map(String))];
      if (picked.some((p) => !allowed.has(p))) {
        return { ok: false, error: "Something went wrong. Please refresh the page." };
      }
      if (q.max !== null && picked.length > q.max) {
        return { ok: false, error: `${q.en}: please pick up to ${q.max}.` };
      }
      if (picked.length) answers[q.key] = picked;
    } else {
      const v = str(fd, q.key);
      if (v && !allowed.has(v)) {
        return { ok: false, error: "Something went wrong. Please refresh the page." };
      }
      if (v) answers[q.key] = v;
    }
    if (q.text) {
      const t = str(fd, `${q.key}__text`);
      if (t.length > 500) return { ok: false, error: `${q.en}: please keep it shorter.` };
      if (t) answers[`${q.key}__text`] = t;
    }
  }

  const comment = str(fd, "comment");
  if (comment.length > 1000) return { ok: false, error: "Please keep the last box shorter." };

  if (Object.keys(answers).length === 0 && !comment) {
    return { ok: false, error: "Please answer at least one question. · ஒரு கேள்விக்காவது பதில்" };
  }

  return {
    ok: true,
    row: {
      respondent_name: name,
      panchayat,
      phone,
      answers,
      comment: comment || null,
    },
  };
}
