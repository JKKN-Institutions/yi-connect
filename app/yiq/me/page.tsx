import Link from "next/link";
import { redirect } from "next/navigation";
import { getYiqSession } from "@/lib/yiq/auth/yiq-session";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import { signOut } from "../actions/auth";
import { STATUS_LABELS, type ChapterEventStatus } from "@/lib/yiq/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "My YIQ" };

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

export default async function MyYiqPage() {
  const session = await getYiqSession();
  if (!session || session.type !== "student") redirect("/yiq/login");

  const svc = await createServiceClient();

  const [{ data: team }, { data: event }, { data: attempts }] = await Promise.all([
    svc
      .from("teams")
      .select("id, name, category, team_code, status, schools(name)")
      .eq("id", session.teamId)
      .maybeSingle(),
    svc
      .from("chapter_events")
      .select("id, chapter_name, status, online_round_opens_at, online_round_closes_at, results_published_at")
      .eq("id", session.chapterEventId)
      .maybeSingle(),
    svc
      .from("attempts")
      .select("id, is_mock, status, score, correct_count, unanswered_count, submitted_at")
      .eq("student_id", session.id)
      .order("created_at", { ascending: false }),
  ]);

  const mocks = (attempts ?? []).filter((a) => a.is_mock);
  const real = (attempts ?? []).find((a) => !a.is_mock);
  const roundLive = event?.status === "online_round_live";
  const bestMock = mocks.reduce(
    (best, m) => (Number(m.score) > best ? Number(m.score) : best),
    0
  );

  return (
    <main id="yiq-main" style={{ background: INK, minHeight: "100vh", color: PAPER }}>
      <header className="border-b" style={{ borderColor: RULE }}>
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <Link href="/yiq" className="yiq-display text-[1.375rem]">
            YIQ
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-[0.8125rem] underline" style={{ color: DIM }}>
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-8">
        <p className="yiq-eyebrow" style={{ color: SAFFRON }}>
          {event?.chapter_name} ·{" "}
          {session.category === "junior" ? "Junior · Cl 9–10" : "Senior · Cl 11–12"}
        </p>
        <h1 className="yiq-display mt-2 text-[2.5rem]">{session.name}</h1>
        <p className="mt-1.5 text-[0.9375rem]" style={{ color: DIM }}>
          {team?.name}
          {(team?.schools as { name: string } | null)?.name
            ? ` · ${(team?.schools as { name: string }).name}`
            : ""}
        </p>

        {/* ---- The real round ------------------------------------------ */}
        <section
          className="mt-8 rounded-2xl p-6"
          style={{ background: "#12224a", border: `1px solid ${RULE}` }}
        >
          <p className="yiq-eyebrow" style={{ color: DIM }}>
            Final online round
          </p>

          {real ? (
            <>
              <h2 className="yiq-display mt-2 text-[1.75rem]">Submitted</h2>
              <p className="mt-2 text-[0.9375rem]" style={{ color: DIM }}>
                Your paper is recorded. Your team&apos;s total is the sum of its
                members&apos; scores — your chapter publishes rankings after the
                round closes.
              </p>
              {event?.results_published_at ? (
                <Link
                  href="/yiq/results"
                  className="mt-5 inline-block rounded-full px-5 py-3 text-[0.875rem] font-bold"
                  style={{ background: SAFFRON, color: INK }}
                >
                  See chapter results
                </Link>
              ) : null}
            </>
          ) : roundLive ? (
            <>
              <h2 className="yiq-display mt-2 text-[1.75rem]">Open now</h2>
              <p className="mt-2 text-[0.9375rem]" style={{ color: DIM }}>
                One attempt only. Once you start, the clock runs — finish in one
                sitting.
              </p>
              <Link
                href="/yiq/quiz?mode=round"
                className="mt-5 inline-block rounded-full px-6 py-3.5 text-[0.9375rem] font-bold"
                style={{ background: SAFFRON, color: INK }}
              >
                Start the round
              </Link>
            </>
          ) : (
            <>
              <h2 className="yiq-display mt-2 text-[1.75rem]">Not open yet</h2>
              <p className="mt-2 text-[0.9375rem]" style={{ color: DIM }}>
                Your chapter opens the round at the scheduled time. Status right
                now:{" "}
                <strong style={{ color: PAPER }}>
                  {STATUS_LABELS[(event?.status ?? "draft") as ChapterEventStatus]}
                </strong>
                . Practise while you wait.
              </p>
            </>
          )}
        </section>

        {/* ---- Practice ------------------------------------------------- */}
        <section
          className="mt-4 rounded-2xl p-6"
          style={{ background: "rgba(247,244,237,0.05)", border: `1px solid ${RULE}` }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="yiq-eyebrow" style={{ color: DIM }}>
                Mock quiz
              </p>
              <h2 className="yiq-display mt-2 text-[1.5rem]">Practise as often as you like</h2>
              <p className="mt-2 text-[0.9375rem]" style={{ color: DIM }}>
                Same format, same seven topics. Practice scores never count
                towards your team.
              </p>
            </div>
            {mocks.length > 0 ? (
              <div className="flex-none text-right">
                <p className="yiq-data text-[1.75rem] font-bold">{bestMock}</p>
                <p className="yiq-eyebrow" style={{ color: DIM }}>
                  Best of {mocks.length}
                </p>
              </div>
            ) : null}
          </div>
          <Link
            href="/yiq/quiz?mode=mock"
            className="mt-5 inline-block rounded-full border px-5 py-3 text-[0.875rem] font-bold"
            style={{ borderColor: RULE, color: PAPER }}
          >
            {mocks.length > 0 ? "Practise again" : "Start practising"}
          </Link>
        </section>

        {/* ---- Team card ------------------------------------------------ */}
        <section className="mt-4 rounded-2xl p-6" style={{ border: `1px solid ${RULE}` }}>
          <p className="yiq-eyebrow" style={{ color: DIM }}>
            Team code
          </p>
          <p className="yiq-data mt-1 text-[1.25rem] font-bold">{team?.team_code}</p>
        </section>
      </div>
    </main>
  );
}
