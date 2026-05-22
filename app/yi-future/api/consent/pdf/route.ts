/**
 * GET /api/consent/pdf
 * Streams a rendered parent consent PDF for the signed-in delegate.
 * Handbook refs: [Consent Letter DOCX, CPB §6, HPB §10]
 */

import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { generateConsentPdf, type ConsentPdfData } from "@/lib/yi-future/consent-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConsentRow = {
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  parent_address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  travel_consent: boolean | null;
  medical_consent: boolean | null;
  liability_consent: boolean | null;
  template_version: number | null;
};

type DelegateRow = {
  full_name: string;
  email: string | null;
  chapters: { name: string } | { name: string }[] | null;
};

export async function GET(): Promise<Response> {
  const session = await readSession();
  if (!session || session.type !== "delegate") {
    return new Response("Unauthorized", { status: 401 });
  }

  const svc = await createServiceClient();

  // 1. Fetch the consent letter for this delegate
  const { data: consentRaw, error: consentErr } = await svc
    .schema("future")
    .from("consent_letters")
    .select(
      "parent_name, parent_email, parent_phone, parent_address, emergency_contact_name, emergency_contact_phone, travel_consent, medical_consent, liability_consent, template_version"
    )
    .eq("delegate_id", session.id)
    .maybeSingle();

  if (consentErr) {
    return new Response(`Database error: ${consentErr.message}`, {
      status: 500,
    });
  }

  const consent = consentRaw as ConsentRow | null;
  if (!consent) {
    return new Response(
      "No consent record found. Please fill and save the consent form first.",
      { status: 404 }
    );
  }

  if (
    !consent.parent_name ||
    !consent.parent_phone ||
    !consent.travel_consent ||
    !consent.medical_consent ||
    !consent.liability_consent
  ) {
    return new Response(
      "Consent form is incomplete. Parent name, phone, and all three consents are required.",
      { status: 400 }
    );
  }

  // 2. Fetch delegate + chapter
  const { data: delegateRaw, error: delegateErr } = await svc
    .schema("future")
    .from("delegates")
    .select("full_name, email, chapters!inner(name)")
    .eq("id", session.id)
    .maybeSingle();

  if (delegateErr || !delegateRaw) {
    return new Response(
      `Delegate record not found${delegateErr ? `: ${delegateErr.message}` : ""}`,
      { status: 500 }
    );
  }

  const delegate = delegateRaw as unknown as DelegateRow;
  const chapterRef = delegate.chapters;
  const chapterName = Array.isArray(chapterRef)
    ? chapterRef[0]?.name ?? "—"
    : chapterRef?.name ?? "—";

  // 3. Assemble data and render
  const pdfData: ConsentPdfData = {
    delegate: {
      full_name: delegate.full_name,
      chapter_name: chapterName,
      email: delegate.email,
    },
    parent_name: consent.parent_name,
    parent_email: consent.parent_email,
    parent_phone: consent.parent_phone,
    parent_address: consent.parent_address,
    emergency_contact_name: consent.emergency_contact_name,
    emergency_contact_phone: consent.emergency_contact_phone,
    travel_consent: !!consent.travel_consent,
    medical_consent: !!consent.medical_consent,
    liability_consent: !!consent.liability_consent,
    template_version: consent.template_version ?? 1,
    generated_at: new Date(),
  };

  const buffer = await generateConsentPdf(pdfData);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="consent-letter.pdf"',
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
