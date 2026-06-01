import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { QUIZ_QUESTIONS } from "@/lib/yi-future/problem-quiz";
import { QuizClient, type QuizProblem } from "./QuizClient";

type ProblemRow = {
  id: string;
  title: string;
  short_description: string;
  display_order: number | null;
  tracks: {
    id: string;
    slug: string;
    name: string;
    icon: string | null;
    color_hex: string | null;
    display_order: number | null;
  } | null;
};

// Fetch ALL 12 problem statements (4 tracks × 3 problems) for the edition.
// Same query shape as /yi-future/me/team/preferences — Future 6.0 runs all 4
// tracks at every chapter, so the quiz scores across the full edition catalog.
async function getEditionProblems(editionId: string): Promise<ProblemRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("problem_statements")
    .select(
      "id, title, short_description, display_order, tracks!inner(id, slug, name, icon, color_hex, display_order, edition_id)"
    )
    .eq("is_active", true)
    .eq("tracks.edition_id", editionId)
    .order("display_order", { ascending: true });
  return (data as unknown as ProblemRow[]) ?? [];
}

export default async function ProblemQuizPage() {
  const session = await readSession();
  if (!session || session.type !== "delegate") redirect("/yi-future/join");

  const rows = await getEditionProblems(session.edition_id);

  const problems: QuizProblem[] = rows
    .filter((p) => p.tracks)
    .map((p) => ({
      id: p.id,
      title: p.title,
      shortDescription: p.short_description,
      trackSlug: p.tracks!.slug,
      trackName: p.tracks!.name,
      trackIcon: p.tracks!.icon,
      trackColorHex: p.tracks!.color_hex ?? "#1a1a3e",
    }));

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/yi-future/me/team/preferences"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← Preferences
        </Link>
        <h2 className="mt-1 text-2xl font-bold text-navy">
          Not sure which problem? Take this 2-minute quiz.
        </h2>
        <p className="mt-1 text-sm text-navy/60">
          Nine quick questions about what excites you. We&apos;ll suggest a
          ranked shortlist of problems that fit. Nothing is saved — it&apos;s
          just to help you decide before you rank your top 3.
        </p>
      </div>

      {problems.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">🧭</div>
          <h3 className="text-lg font-bold text-navy">No problems yet</h3>
          <p className="mt-2 text-sm text-navy/60">
            The problem catalog isn&apos;t set up for your edition yet. Check
            back after your edition is configured.
          </p>
          <Link
            href="/yi-future/me/team/preferences"
            className="mt-4 inline-block text-sm text-navy font-semibold hover:text-yi-gold"
          >
            ← Back to preferences
          </Link>
        </div>
      ) : (
        <QuizClient problems={problems} questions={QUIZ_QUESTIONS} />
      )}
    </div>
  );
}
