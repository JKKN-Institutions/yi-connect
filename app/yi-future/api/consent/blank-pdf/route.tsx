/**
 * GET /api/consent/blank-pdf
 *
 * Streams a pre-filled but UNSIGNED consent letter for the signed-in
 * delegate. The delegate prints, gets a parent/guardian signature, scans
 * or photographs, then uploads via /me/consent.
 *
 * Reads:    yifuture_session cookie (delegate type)
 * Lookups:  future.delegates -> full_name, college_id
 *           future.colleges  -> name (joined for printable college label)
 * Renders:  <ConsentLetterPDF delegate={…} /> via renderToStream
 *
 * Handbook refs: [Consent Letter DOCX, CPB §6, HPB §10]
 */

import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { ConsentLetterPDF } from "@/lib/yi-future/consent-pdf";
import { renderToStream } from "@react-pdf/renderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DelegateRow = {
  full_name: string;
  colleges: { name: string } | { name: string }[] | null;
};

function firstNameOf(fullName: string): string {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) return "delegate";
  const first = trimmed.split(/\s+/)[0] ?? "delegate";
  // strip anything that wouldn't be HTTP-header-safe in a filename
  return first.replace(/[^A-Za-z0-9_-]/g, "") || "delegate";
}

export async function GET(): Promise<Response> {
  const session = await readSession();
  if (!session || session.type !== "delegate") {
    return new Response("Unauthorized — sign in as a delegate.", {
      status: 401,
    });
  }

  const svc = await createServiceClient();

  const { data: delegateRaw, error } = await svc
    .schema("future")
    .from("delegates")
    .select("full_name, colleges(name)")
    .eq("id", session.id)
    .maybeSingle();

  if (error || !delegateRaw) {
    return new Response(
      `Delegate record not found${error ? `: ${error.message}` : ""}`,
      { status: 404 }
    );
  }

  const delegate = delegateRaw as unknown as DelegateRow;
  const collegeRef = delegate.colleges;
  const collegeName = Array.isArray(collegeRef)
    ? collegeRef[0]?.name ?? null
    : collegeRef?.name ?? null;

  const element = (
    <ConsentLetterPDF
      delegate={{
        full_name: delegate.full_name,
        college_name: collegeName,
      }}
    />
  );

  // renderToStream returns a Node Readable; web Response accepts it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = (await renderToStream(element as any)) as unknown as
    | ReadableStream
    | NodeJS.ReadableStream;

  const filename = `Future-6.0-Consent-${firstNameOf(delegate.full_name)}.pdf`;

  return new Response(stream as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
