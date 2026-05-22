import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import {
  approveConsent,
  rejectConsent,
} from "@/app/yi-future/actions/consent";

type Row = {
  id: string;
  status: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  signed_pdf_url: string | null;
  travel_consent: boolean | null;
  medical_consent: boolean | null;
  liability_consent: boolean | null;
  uploaded_at: string | null;
  rejection_reason: string | null;
  delegates: {
    id: string;
    full_name: string;
    email: string | null;
    chapter_id: string;
    edition_id: string;
  } | null;
};

async function getConsents(
  chapterId: string,
  editionId: string
): Promise<Row[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("consent_letters")
    .select(
      "id, status, parent_name, parent_phone, signed_pdf_url, travel_consent, medical_consent, liability_consent, uploaded_at, rejection_reason, delegates!inner(id, full_name, email, chapter_id, edition_id)"
    )
    .eq("delegates.chapter_id", chapterId)
    .eq("delegates.edition_id", editionId)
    .order("uploaded_at", { ascending: false, nullsFirst: false });
  return (data as unknown as Row[]) ?? [];
}

async function approve(formData: FormData) {
  "use server";
  await approveConsent(String(formData.get("id") ?? ""));
}

async function reject(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  await rejectConsent(id, reason);
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-navy/5 text-navy/60",
  uploaded: "bg-yi-saffron/10 text-yi-saffron",
  approved: "bg-yi-green/10 text-yi-green",
  rejected: "bg-red-100 text-red-700",
};

export default async function ChapterConsentPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const rows = await getConsents(ctx.chapterId, ctx.editionId);
  const uploadedCount = rows.filter((r) => r.status === "uploaded").length;
  const approvedCount = rows.filter((r) => r.status === "approved").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Consent review</h2>
        <p className="mt-1 text-sm text-navy/60">
          {rows.length} consent record(s) · {uploadedCount} awaiting review ·{" "}
          {approvedCount} approved
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-sm text-navy/50">
          No delegates have started their consent yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const allChecked =
              r.travel_consent && r.medical_consent && r.liability_consent;
            const status = r.status ?? "pending";
            return (
              <article
                key={r.id}
                className="bg-white border border-navy/10 rounded-lg p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-bold text-navy">
                      {r.delegates?.full_name ?? "—"}
                    </div>
                    <div className="text-xs text-navy/60 mt-0.5">
                      {r.delegates?.email}
                    </div>
                    <div className="text-xs text-navy/50 mt-1">
                      Parent: {r.parent_name ?? "—"}
                      {r.parent_phone && ` · ${r.parent_phone}`}
                    </div>
                    {r.uploaded_at && (
                      <div className="text-[10px] text-navy/40 mt-0.5">
                        Uploaded{" "}
                        {new Date(r.uploaded_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      STATUS_STYLE[status] ?? ""
                    }`}
                  >
                    {status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 mb-3 text-xs">
                  <span
                    className={
                      r.travel_consent ? "text-yi-green" : "text-navy/40"
                    }
                  >
                    {r.travel_consent ? "✓" : "✗"} travel
                  </span>
                  <span
                    className={
                      r.medical_consent ? "text-yi-green" : "text-navy/40"
                    }
                  >
                    {r.medical_consent ? "✓" : "✗"} medical
                  </span>
                  <span
                    className={
                      r.liability_consent ? "text-yi-green" : "text-navy/40"
                    }
                  >
                    {r.liability_consent ? "✓" : "✗"} liability
                  </span>
                  {r.signed_pdf_url ? (
                    <a
                      href={r.signed_pdf_url}
                      target="_blank"
                      rel="noopener"
                      className="ml-auto text-yi-gold font-semibold hover:underline"
                    >
                      Open PDF ↗
                    </a>
                  ) : (
                    <span className="ml-auto text-navy/40">no PDF</span>
                  )}
                </div>

                {r.rejection_reason && (
                  <div className="p-2 rounded bg-red-50 border border-red-200 text-xs text-red-700 mb-3">
                    <span className="font-semibold">Rejected: </span>
                    {r.rejection_reason}
                  </div>
                )}

                {status === "uploaded" && allChecked && r.signed_pdf_url && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-navy/10">
                    <form action={reject} className="flex-1 flex gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <input
                        name="reason"
                        placeholder="Rejection reason"
                        className="flex-1 px-2 py-1.5 border border-navy/20 rounded text-xs"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200"
                      >
                        Reject
                      </button>
                    </form>
                    <form action={approve}>
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded text-xs font-semibold bg-yi-green text-ivory hover:opacity-90"
                      >
                        Approve
                      </button>
                    </form>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <p className="text-xs text-navy/40">
        <Link
          href="/yi-future/chapter/delegates"
          className="underline hover:text-navy"
        >
          Back to delegates →
        </Link>
      </p>
    </div>
  );
}
