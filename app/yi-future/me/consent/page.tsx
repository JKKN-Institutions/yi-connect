/**
 * /me/consent — Delegate-facing parent consent flow.
 *
 * UX states:
 *   1. Not yet downloaded   → big "Download my consent letter" button +
 *                              instructions + URL upload widget (visible too,
 *                              in case parent already signed elsewhere).
 *   2. Downloaded, not uploaded → Upload widget (paste signed PDF URL).
 *   3. Uploaded, pending review → "Submitted" banner with link preview.
 *   4. Approved / Rejected      → Status banner; rejected can re-upload.
 *
 * Storage: future.consent_letters (one row per delegate, UNIQUE on delegate_id).
 * The "downloaded" stub row is created on first GET of the blank PDF — but
 * because the API route should stay GET-only and side-effect-free, we
 * additionally let the user click a "Mark downloaded" toggle implicitly by
 * landing the upload widget right under the download button. State 1 and
 * State 2 share the same UI in practice; the only material difference is
 * whether a row exists.
 *
 * Handbook refs: [Consent Letter DOCX, CPB §6, HPB §10]
 */

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";

type ConsentRow = {
  id: string;
  status: string | null;
  signed_pdf_url: string | null;
  rejection_reason: string | null;
  uploaded_at: string | null;
  approved_at: string | null;
};

async function getConsent(delegateId: string): Promise<ConsentRow | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("consent_letters")
    .select(
      "id, status, signed_pdf_url, rejection_reason, uploaded_at, approved_at"
    )
    .eq("delegate_id", delegateId)
    .maybeSingle();
  return (data as unknown as ConsentRow) ?? null;
}

// ─── Inline server action: paste-URL upload ─────────────────────────
async function uploadSignedUrl(formData: FormData): Promise<void> {
  "use server";

  const session = await readSession();
  if (!session || session.type !== "delegate") {
    redirect("/yi-future/join");
  }
  const delegateId = session!.id;

  const raw = String(formData.get("signed_pdf_url") ?? "").trim();
  if (!raw) return;

  // Cheap URL validation
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return;
  } catch {
    return;
  }

  const svc = await createServiceClient();

  // Upsert: insert if no row yet, otherwise update.
  const { data: existing } = await svc
    .schema("future")
    .from("consent_letters")
    .select("id, status")
    .eq("delegate_id", delegateId)
    .maybeSingle();
  const ex = existing as { id: string; status: string | null } | null;

  if (ex && ex.status === "approved") {
    // Already approved — don't allow silent overwrite.
    revalidatePath("/yi-future/me/consent");
    return;
  }

  const nowIso = new Date().toISOString();
  const payload = {
    delegate_id: delegateId,
    signed_pdf_url: raw,
    status: "uploaded",
    uploaded_at: nowIso,
    template_version: 2,
    rejection_reason: null,
    updated_at: nowIso,
  };

  if (ex) {
    await svc
      .schema("future")
      .from("consent_letters")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(payload as never)
      .eq("id", ex.id);
  } else {
    await svc
      .schema("future")
      .from("consent_letters")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(payload as never);
  }

  revalidatePath("/yi-future/me/consent");
  revalidatePath("/yi-future/chapter/consent");
}

// ─── PAGE ───────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, string> = {
  pending: "bg-navy/5 text-navy/60",
  uploaded: "bg-yi-saffron/10 text-yi-saffron",
  approved: "bg-yi-green/10 text-yi-green",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Not yet uploaded",
  uploaded: "Submitted — pending review",
  approved: "Approved",
  rejected: "Needs revision",
};

export default async function MyConsentPage() {
  const session = await readSession();
  if (!session || session.type !== "delegate") redirect("/yi-future/join");

  const c = await getConsent(session.id);
  const status = c?.status ?? "not_started";
  const isApproved = status === "approved";
  const isUploaded = status === "uploaded";
  const isRejected = status === "rejected";
  const hasSignedUrl = !!c?.signed_pdf_url;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/yi-future/me"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← Dashboard
        </Link>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h2 className="text-2xl font-bold text-navy">Parent consent</h2>
          <span
            className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${
              STATUS_STYLE[status] ?? "bg-navy/5 text-navy/60"
            }`}
          >
            {STATUS_LABEL[status] ?? status.replace("_", " ")}
          </span>
        </div>
        <p className="mt-1 text-sm text-navy/60">
          A signed parent / guardian consent letter is mandatory before any
          travel to the National Track Final.
        </p>
      </div>

      {/* ─── Status banners ────────────────────────────────────── */}
      {isApproved && (
        <div className="bg-yi-green/5 border border-yi-green/30 rounded-md p-4 text-sm text-yi-green">
          <div className="font-semibold mb-1">Approved ✓</div>
          <p>
            Your parent consent is on file and approved by your chapter admin.
            You&apos;re cleared to travel to the National Final.
          </p>
        </div>
      )}

      {isRejected && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-700">
          <div className="font-semibold mb-1">Needs revision</div>
          {c?.rejection_reason && <p>{c.rejection_reason}</p>}
          <p className="mt-2 text-xs">
            Please fix the issue and re-upload below.
          </p>
        </div>
      )}

      {isUploaded && c?.signed_pdf_url && (
        <div className="bg-yi-saffron/5 border border-yi-saffron/30 rounded-md p-4 text-sm text-navy/80">
          <div className="font-semibold mb-1 text-yi-saffron">
            Submitted — pending chapter admin review
          </div>
          <p className="mt-1">
            We&apos;ve received your signed consent letter. Your chapter admin
            will review and approve it shortly.
          </p>
          <a
            href={c.signed_pdf_url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs font-mono text-yi-saffron hover:text-navy underline break-all"
          >
            {c.signed_pdf_url}
          </a>
          {c.uploaded_at && (
            <p className="mt-1 text-xs text-navy/40">
              Uploaded {new Date(c.uploaded_at).toLocaleString("en-IN")}
            </p>
          )}
        </div>
      )}

      {/* ─── Step 1: Download ──────────────────────────────────── */}
      {!isApproved && (
        <div className="bg-white border border-navy/10 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-widest text-navy/70">
              Step 1 · Download
            </div>
            {hasSignedUrl && (
              <span className="text-[10px] font-semibold uppercase tracking-widest text-yi-green/70">
                ✓ done
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-navy">
            Get your pre-filled consent letter
          </h3>
          <p className="text-sm text-navy/70">
            Your name and college are already filled in. The parent /
            guardian fills in their own name, address, signs, and dates the
            letter.
          </p>
          <a
            href="/api/consent/blank-pdf"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-yi-gold text-navy text-sm font-semibold hover:bg-yi-saffron hover:text-ivory"
            download
          >
            Download my consent letter (PDF)
          </a>
          <ol className="mt-3 space-y-1.5 text-sm text-navy/70 list-decimal list-inside">
            <li>Print the PDF.</li>
            <li>
              Get a parent or legal guardian to fill, date, and sign the
              letter.
            </li>
            <li>
              Scan the signed sheets or take clear photographs (PDF / JPG).
            </li>
            <li>Upload the signed scan in Step 2 below.</li>
          </ol>
        </div>
      )}

      {/* ─── Step 2: Upload ────────────────────────────────────── */}
      {!isApproved && (
        <form
          action={uploadSignedUrl}
          className="bg-white border border-navy/10 rounded-lg p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-widest text-navy/70">
              Step 2 · Upload
            </div>
            {isUploaded && (
              <span className="text-[10px] font-semibold uppercase tracking-widest text-yi-saffron/80">
                pending review
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-navy">
            Paste the signed scan&rsquo;s share link
          </h3>
          <p className="text-sm text-navy/70">
            Upload the signed scan to Google Drive, Dropbox, or any cloud
            storage. Make sure anyone with the link can view, then paste the
            URL below.
          </p>
          <input
            name="signed_pdf_url"
            type="url"
            required
            defaultValue={c?.signed_pdf_url ?? ""}
            placeholder="https://drive.google.com/file/d/…"
            className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm font-mono"
          />
          <div className="flex items-center justify-between pt-2 border-t border-navy/10">
            <p className="text-xs text-navy/50">
              We&apos;ll mark your consent as submitted once you save.
            </p>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              {hasSignedUrl ? "Re-upload" : "Submit signed consent"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
