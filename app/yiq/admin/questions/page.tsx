import Link from "next/link";
import { requireYiqSuperAdmin } from "@/lib/yiq/auth/require-super-admin";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import { Forbidden403 } from "../../_components/Forbidden403";
import { listQuestions } from "../../actions/admin-questions";
import { QuestionManager } from "./question-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Question bank" };

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

/**
 * The national question bank.
 *
 * PLATFORM master data — gated by requireYiqSuperAdmin(), not by the
 * event-scoped gate. A change here reaches every chapter in the country.
 */
export default async function YiqQuestionBankPage() {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) {
    return (
      <Forbidden403
        what="the YIQ national question bank"
        reason="not_yiq_super_admin"
      />
    );
  }

  const svc = await createServiceClient();

  const [{ data: topics }, initial, { count: retiredCount }, { count: awaitingReview }] =
    await Promise.all([
    svc
      .from("topics")
      .select("id, slug, name")
      .eq("is_active", true)
      .order("display_order"),
    listQuestions({ page: 1 }),
    svc
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("is_retired", true),
    // Drafted by a model, never read by a person. These may only appear on a
    // practice paper until someone signs them off (Director rule 7).
    svc
      .from("questions")
      .select("id", { count: "exact", head: true })
      .is("reviewed_at", null)
      .eq("is_ai_generated", true)
      .eq("is_retired", false),
  ]);

  return (
    <main
      id="yiq-main"
      style={{ background: INK, minHeight: "100vh", color: PAPER }}
    >
      <header className="border-b" style={{ borderColor: RULE }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link
            href="/yiq/admin"
            className="text-[0.875rem]"
            style={{ color: DIM }}
          >
            ← National admin
          </Link>
          <span className="yiq-eyebrow" style={{ color: SAFFRON }}>
            Question bank
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <h1 className="yiq-display text-[2.25rem] sm:text-[2.75rem]">
          Question bank
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed" style={{ color: DIM }}>
          One national bank feeds every chapter&apos;s paper. Retire a question
          rather than deleting it — a question that has been sat is part of a
          graded result and cannot be removed.
        </p>

        {awaitingReview && awaitingReview > 0 ? (
          <Link
            href="/yiq/admin/questions/review"
            className="mt-4 inline-block rounded-full px-4 py-2 text-[0.875rem] font-medium"
            style={{ background: SAFFRON, color: INK }}
          >
            {awaitingReview} question{awaitingReview === 1 ? "" : "s"} awaiting your
            review
          </Link>
        ) : null}

        <QuestionManager
          topics={topics ?? []}
          initialRows={initial.success ? initial.rows : []}
          initialTotal={initial.success ? initial.total : 0}
          pageSize={initial.success ? initial.pageSize : 25}
          retiredCount={retiredCount ?? 0}
          loadError={initial.success ? null : initial.error}
        />
      </div>
    </main>
  );
}
