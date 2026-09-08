import Link from "next/link";
import { createServiceClient } from "@/lib/yiq/supabase/server";

export const revalidate = 120;
export const metadata = { title: "Results" };

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

export default async function ResultsIndexPage() {
  const svc = await createServiceClient();

  const { data: edition } = await svc
    .from("editions")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  const { data: events } = edition
    ? await svc
        .from("chapter_events")
        .select("id, chapter_name, yi_zone, results_published_at")
        .eq("edition_id", edition.id)
        .not("results_published_at", "is", null)
        .order("chapter_name")
    : { data: [] };

  return (
    <main id="yiq-main" style={{ background: INK, minHeight: "100vh", color: PAPER }}>
      <header className="border-b" style={{ borderColor: RULE }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/yiq" className="yiq-display text-[1.375rem]">
            YIQ
          </Link>
          <span className="yiq-eyebrow" style={{ color: DIM }}>
            {edition?.name ?? "Results"}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-9 sm:px-8">
        <h1 className="yiq-display text-[2.75rem]">Chapter results</h1>
        <p className="mt-2 text-[0.9375rem]" style={{ color: DIM }}>
          Published standings from the Final Online Round.
        </p>

        {(events ?? []).length === 0 ? (
          <p className="mt-8 text-[0.9375rem]" style={{ color: DIM }}>
            No chapter has published its standings yet. Results appear here as
            each chapter closes its online round.
          </p>
        ) : (
          <ul className="mt-8 grid gap-2.5">
            {(events ?? []).map((e) => (
              <li key={e.id}>
                <Link
                  href={`/yiq/results/${e.id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 transition-colors hover:bg-white/5"
                  style={{ borderColor: RULE }}
                >
                  <span className="text-[1.0625rem] font-bold">{e.chapter_name}</span>
                  <span className="yiq-eyebrow" style={{ color: SAFFRON }}>
                    View →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
