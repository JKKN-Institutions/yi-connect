import Link from "next/link";
import { requireYiqSuperAdmin } from "@/lib/yiq/auth/require-super-admin";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import { Forbidden403 } from "../_components/Forbidden403";
import { PaperTools } from "./paper-tools";

export const dynamic = "force-dynamic";
export const metadata = { title: "National admin" };

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

export default async function YiqAdminPage() {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) {
    return <Forbidden403 what="YIQ national administration" reason="not_yiq_super_admin" />;
  }

  const svc = await createServiceClient();

  const [{ data: papers }, { data: topics }, { count: questionCount }, { count: teamCount }] =
    await Promise.all([
      svc
        .from("papers")
        .select("id, name, paper_kind, category, duration_minutes, total_questions, is_published")
        .order("created_at", { ascending: false }),
      svc
        .from("topics")
        .select("id, name, slug")
        .eq("is_active", true)
        .order("display_order"),
      svc
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      svc.from("teams").select("id", { count: "exact", head: true }),
    ]);

  // Bank depth per topic — the number that tells you whether you can build a
  // real paper yet.
  const { data: perTopic } = await svc
    .from("questions")
    .select("topic_id")
    .eq("is_active", true)
    .eq("is_retired", false);

  const counts = new Map<string, number>();
  for (const q of perTopic ?? []) {
    counts.set(q.topic_id, (counts.get(q.topic_id) ?? 0) + 1);
  }

  return (
    <main id="yiq-main" style={{ background: INK, minHeight: "100vh", color: PAPER }}>
      <header className="border-b" style={{ borderColor: RULE }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/yiq/dashboard" className="text-[0.875rem]" style={{ color: DIM }}>
            ← Chapter dashboard
          </Link>
          <span className="yiq-eyebrow" style={{ color: SAFFRON }}>
            YIQ national
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-9 sm:px-8">
        <h1 className="yiq-display text-[2.75rem]">National admin</h1>
        <p className="mt-2 text-[0.9375rem]" style={{ color: DIM }}>
          The question bank and papers are shared national master data — a
          change here reaches every chapter.
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { l: "Questions", v: questionCount ?? 0 },
            { l: "Topics", v: (topics ?? []).length },
            { l: "Papers", v: (papers ?? []).length },
            { l: "Teams registered", v: teamCount ?? 0 },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border p-4" style={{ borderColor: RULE }}>
              <dt className="yiq-eyebrow" style={{ color: DIM }}>
                {s.l}
              </dt>
              <dd className="yiq-data mt-1.5 text-[1.75rem] font-bold">{s.v}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-10">
          <h2 className="yiq-display text-[1.5rem]">Bank depth by topic</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {(topics ?? []).map((t) => {
              const n = counts.get(t.id) ?? 0;
              const thin = n < 20;
              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{ background: "rgba(247,244,237,0.05)" }}
                >
                  <span className="text-[0.9375rem] font-semibold">{t.name}</span>
                  <span
                    className="yiq-data text-[1rem] font-bold"
                    style={{ color: thin ? SAFFRON : PAPER }}
                  >
                    {n}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[0.8125rem]" style={{ color: SAFFRON }}>
            Topics under 20 questions are marked. A live round needs far more —
            and the practice pool must not overlap the round pool.
          </p>
        </section>

        <PaperTools papers={papers ?? []} />
      </div>
    </main>
  );
}
