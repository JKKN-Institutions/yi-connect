/**
 * Read side of the village feedback: every row for one survey, plus a tally
 * per question and option. Read through the admin client; the only caller is
 * the committee results page, which gates on getVarnamAccess first.
 */
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { ruralFeedbackTable } from "./guard";
import { QUESTIONS, type SurveyQuestion } from "./anumanpalli-survey";

export type FeedbackRecord = {
  id: string;
  respondent_name: string;
  panchayat: string;
  phone: string | null;
  answers: Record<string, string | string[]>;
  comment: string | null;
  created_at: string;
};

export type QuestionTally = {
  question: SurveyQuestion;
  answered: number;
  counts: { key: string; ta: string; en: string; n: number }[];
  texts: { name: string; text: string }[];
};

const PAGE = 1000;

/** Pages past the 1,000-row API cap so a large village never shows a frozen total. */
export async function getFeedback(surveyKey: string): Promise<FeedbackRecord[]> {
  const sb = createAdminSupabaseClient();
  const out: FeedbackRecord[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await ruralFeedbackTable(sb)
      .select("id, respondent_name, panchayat, phone, answers, comment, created_at")
      .eq("survey_key", surveyKey)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Could not read village feedback: ${error.message}`);
    out.push(...((data ?? []) as FeedbackRecord[]));
    if (!data || data.length < PAGE) return out;
  }
}

export function tally(rows: FeedbackRecord[]): QuestionTally[] {
  return QUESTIONS.map((q) => {
    const counts = q.options.map((o) => ({ key: o.key, ta: o.ta, en: o.en, n: 0 }));
    let answered = 0;
    const texts: { name: string; text: string }[] = [];
    for (const r of rows) {
      const raw = r.answers?.[q.key];
      const picked = Array.isArray(raw) ? raw : raw ? [raw] : [];
      if (picked.length) answered += 1;
      for (const p of picked) {
        const c = counts.find((x) => x.key === p);
        if (c) c.n += 1;
      }
      const t = r.answers?.[`${q.key}__text`];
      if (typeof t === "string" && t) texts.push({ name: r.respondent_name, text: t });
    }
    counts.sort((a, b) => b.n - a.n);
    return { question: q, answered, counts, texts };
  });
}
