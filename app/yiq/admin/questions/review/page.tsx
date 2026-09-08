import Link from "next/link";
import { requireYiqSuperAdmin } from "@/lib/yiq/auth/require-super-admin";
import { Forbidden403 } from "../../../_components/Forbidden403";
import { listQuestions } from "../../../actions/admin-questions";
import { ReviewQueue } from "./review-queue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Questions awaiting review" };

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

/**
 * The review queue — the human half of Director rule 7, "the bank grows by
 * AI draft + HUMAN approval".
 *
 * Everything here was drafted by a model and has never been read by a
 * person. Approving a question moves it into the competition pool and
 * stamps the reviewer against it, permanently. Until then it can only
 * appear on a practice paper.
 *
 * PLATFORM master data — requireYiqSuperAdmin(), not the event gate. This
 * is not a chapter organiser's decision; it reaches every chapter.
 */
export default async function YiqQuestionReviewPage() {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) {
    return (
      <Forbidden403
        what="the YIQ question review queue"
        reason="not_yiq_super_admin"
      />
    );
  }

  const initial = await listQuestions({ needsReview: true, page: 1, pageSize: 50 });

  return (
    <main style={{ background: INK, color: PAPER, minHeight: "100vh" }}>
      <div className="mx-auto w-full max-w-[72rem] px-4 py-10 sm:px-6">
        <Link
          href="/yiq/admin/questions"
          className="text-[0.8125rem] underline"
          style={{ color: DIM }}
        >
          Back to the question bank
        </Link>

        <h1 className="yiq-display mt-4 text-[2rem] leading-tight sm:text-[2.5rem]">
          Awaiting review
        </h1>

        <p className="mt-3 max-w-[46rem] text-[0.9375rem]" style={{ color: DIM }}>
          Every question here was drafted by a model and has not yet been read
          by a person. It can appear on a <strong style={{ color: PAPER }}>practice</strong>{" "}
          paper today. Approving it moves it into the{" "}
          <strong style={{ color: SAFFRON }}>competition</strong> pool, where it
          can be drawn for a scored round in any chapter in the country — and
          records your name against it.
        </p>

        <p className="mt-3 max-w-[46rem] text-[0.875rem]" style={{ color: DIM }}>
          Read the question, the four options and the explanation. Check that
          the explanation actually justifies the recorded answer. If anything is
          wrong, edit it in the question bank first and come back.
        </p>

        <div
          className="mt-8 rounded-2xl border p-1"
          style={{ borderColor: RULE }}
        >
          <ReviewQueue
            initialQuestions={initial.success ? initial.rows : []}
            initialTotal={initial.success ? initial.total : 0}
            loadError={initial.success ? null : initial.error}
          />
        </div>
      </div>
    </main>
  );
}
