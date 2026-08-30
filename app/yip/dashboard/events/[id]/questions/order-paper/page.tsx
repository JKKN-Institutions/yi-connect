import { redirect } from "next/navigation";
import { MonitorPlay } from "lucide-react";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getQuestions } from "@/app/yip/actions/questions";
import type { QuestionWithSubmitter } from "@/app/yip/actions/questions";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { ministryLabel as resolveMinistryLabel } from "@/lib/yip/cabinet";
import { getCabinetConfig } from "@/app/yip/actions/cabinet";
import { PrintButton } from "./print-button";
import { OrderPaperProjector, type ProjectorQuestion } from "./projector-view";

/**
 * The "List of Business" for Question Hour — the approved questions in call
 * order, grouped by ministry, in two shapes from one page and one gate:
 *
 *   • default        — A4, printable, for the Chair's chapter report.
 *   • ?view=projector — large type on a dark screen, for the hall.
 *
 * Only APPROVED, non-mock questions appear, and that is the whole point: a
 * question that has been put moves to 'asked' / 'answered' / 'skipped', so
 * everything listed here is a question a member researched and wrote that the
 * House has not yet heard. On the SRTN regional round that was 135 of them.
 *
 * Questions only. The member who tabled it is named — it is their own authored
 * work — and nothing else about them appears: no marks, no position, no rank.
 *
 * Gated exactly like the questions page (getEvent → getYipEventAccess.canView,
 * Forbidden403 on no-access).
 */
export default async function OrderPaperPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const { view } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yip/login");

  const event = await getEvent(id);
  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's questions. The event may have been deleted, or your role may not include this event's chapter or region." />
    );
  }

  // Resolve ministry KEYs against the event's effective cabinet portfolios
  // (per-event custom ministries), falling back to "Unassigned" for a null
  // ministry and to the raw key for any unknown key.
  const { ministries } = await getCabinetConfig(id);
  const ministryLabel = (key: string | null): string =>
    key ? resolveMinistryLabel(key, ministries) : "Unassigned";

  const all = await getQuestions(id);
  const approved = all
    .filter((q) => q.status === "approved" && !q.is_mock)
    .sort((a, b) => {
      const am = ministryLabel(a.directed_to_ministry);
      const bm = ministryLabel(b.directed_to_ministry);
      if (am !== bm) return am.localeCompare(bm);
      const ao = a.queue_order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.queue_order ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return (a.created_at ?? "").localeCompare(b.created_at ?? "");
    });

  // ─── Projector ──────────────────────────────────────────────────
  // Same list, same gate, sized for the back of the hall. Flat rather than
  // grouped: the ministry rides on each question so a screen never opens with
  // an orphaned heading.
  if (view === "projector") {
    const projectorQuestions: ProjectorQuestion[] = approved.map((q) => ({
      id: q.id,
      ministry: ministryLabel(q.directed_to_ministry),
      text: q.question_text,
      memberName: q.submitter?.full_name ?? "—",
      constituency: q.submitter?.constituency_name ?? null,
    }));

    return (
      <OrderPaperProjector
        eventName={event.name ?? ""}
        questions={projectorQuestions}
        backHref={`/yip/dashboard/events/${id}/questions/order-paper`}
      />
    );
  }

  // Group by ministry, preserving the sorted order.
  const groups: { ministry: string; items: QuestionWithSubmitter[] }[] = [];
  for (const q of approved) {
    const m = ministryLabel(q.directed_to_ministry);
    let g = groups.find((x) => x.ministry === m);
    if (!g) {
      g = { ministry: m, items: [] };
      groups.push(g);
    }
    g.items.push(q);
  }

  return (
    <div
      id="yip-order-paper"
      className="mx-auto max-w-3xl bg-white px-8 py-8 text-[#1a1a3e] print:px-0 print:py-0"
    >
      {/* Print isolation (mirrors the report's report-print.css): hide the whole
          app shell — dashboard nav, event sidebar, header — and print ONLY this
          order paper, pinned top-left. Without this the sidebar bleeds into the
          saved PDF. */}
      <style>{`@media print {
        @page { margin: 18mm; }
        html, body { background: #ffffff !important; }
        body * { visibility: hidden; }
        #yip-order-paper, #yip-order-paper * { visibility: visible; }
        #yip-order-paper { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
        .no-print { display: none !important; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }`}</style>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C2691A]">
            List of Business
          </p>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
            Question Hour — Order Paper
          </h1>
          <p className="mt-0.5 text-sm text-[#1a1a3e]/60">
            {event.name} · {approved.length} approved question
            {approved.length === 1 ? "" : "s"} not yet put to the House
          </p>
        </div>
        <div className="no-print flex shrink-0 items-center gap-2">
          <a
            href={`/yip/dashboard/events/${id}/questions/order-paper?view=projector`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#1a1a3e]/15 px-3 py-1.5 text-xs font-medium text-[#1a1a3e]/70 transition-colors hover:bg-[#1a1a3e]/5"
          >
            <MonitorPlay className="size-3.5" />
            Projector
          </a>
          <PrintButton />
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-[#1a1a3e]/50">
          No approved questions to list yet. Approve questions on the Question
          Hour page and they will appear here.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.ministry} className="break-inside-avoid">
              <h2 className="mb-2 border-b border-[#1a1a3e]/15 pb-1 text-sm font-bold uppercase tracking-wide">
                {g.ministry}{" "}
                <span className="font-normal text-[#1a1a3e]/45">· {g.items.length}</span>
              </h2>
              <ol className="space-y-3">
                {g.items.map((q, i) => (
                  <li key={q.id} className="break-inside-avoid text-sm">
                    <p className="font-semibold">
                      {i + 1}. {q.submitter?.full_name ?? "—"}
                      {q.submitter?.constituency_name ? (
                        <span className="font-normal text-[#1a1a3e]/55">
                          {" "}
                          · {q.submitter.constituency_name}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-[#1a1a3e]/85">
                      {q.question_text}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      <p className="no-print mt-8 text-xs text-[#1a1a3e]/40">
        Tip: use your browser&apos;s print dialog and choose &quot;Save as PDF&quot;.
      </p>
    </div>
  );
}
