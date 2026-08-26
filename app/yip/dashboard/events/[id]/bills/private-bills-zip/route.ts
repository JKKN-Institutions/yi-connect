// Download every Private Member's Bill in one event as a single ZIP.
//
// The Director asked for "a zip of the students' uploaded files" — but only
// SOME Private Member's Bills carry an uploaded document; the rest exist as
// form-only bills (title/objective/provisions typed straight into the page,
// no file attached). A zip of uploads alone would silently drop those bills
// from the download with no sign anything was missing. So "download all"
// means literally all: every bill gets a folder named by its title + the
// Member who moved it, containing
//   - the bill's own attached document, if it has one, AND
//   - a plain-text rendering of the bill's form fields (always present, even
//     when there is no document) — so a form-only bill is still fully in
//     the archive, not silently absent from it.
// A Route Handler rather than a Server Action because the response IS a file
// (see app/yi-future/national/admin/submission-export/download/route.ts for
// the sibling pattern this borrows from).

import { NextResponse } from "next/server";
import { zipSync, strToU8, type Zippable } from "fflate";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { clauseTexts } from "@/lib/yip/bill-provisions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Downloading + zipping several attachments takes longer than the default budget.
export const maxDuration = 300;

const BUCKET = "yip-bill-documents";

/** Path-safe name for a ZIP folder/file — no traversal, no illegal characters. */
function safeName(raw: string, fallback = "file"): string {
  const cleaned = raw
    .replace(/[^A-Za-z0-9 ._-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[ _.]+|[ _.]+$/g, "")
    .slice(0, 100);
  return cleaned || fallback;
}

/** Dedupe folder names: two bills can share a title + mover-less placeholder. */
function dedupe(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  let n = 2;
  while (used.has(`${name} (${n})`)) n++;
  const final = `${name} (${n})`;
  used.add(final);
  return final;
}

type PrivateBillRow = {
  id: string;
  title: string;
  objective: string | null;
  problem_statement: string | null;
  provisions: unknown;
  expected_impact: string | null;
  implementation: string | null;
  status: string | null;
  mover_participant_id?: string | null;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id: eventId } = await params;

  // Same minimum this whole page is gated at (getEvent → getYipEventAccess).
  const access = await getYipEventAccess(eventId);
  if (!access.canView) {
    return NextResponse.json(
      { error: "Not authorized to view this event" },
      { status: 403 }
    );
  }

  const supabase = await createServiceClient();

  // `source` / `mover_participant_id` are newer columns not in the generated
  // types (types/yip/database.ts lags the bill-sources migration) — select("*")
  // and cast, the pattern app/yip/actions/bills.ts already uses (getBills).
  const { data: billsRaw, error: billsError } = await supabase
    .from("bills")
    .select("*")
    .eq("event_id", eventId)
    .eq("source", "private_member");

  if (billsError) {
    return NextResponse.json({ error: billsError.message }, { status: 500 });
  }

  const bills = (billsRaw ?? []) as unknown as PrivateBillRow[];
  if (bills.length === 0) {
    return NextResponse.json(
      {
        error:
          "No Private Member's Bills have been written for this event yet.",
      },
      { status: 404 }
    );
  }

  // Mover names, one query.
  const moverIds = [
    ...new Set(
      bills
        .map((b) => b.mover_participant_id ?? null)
        .filter((id): id is string => !!id)
    ),
  ];
  const moverNameById = new Map<string, string>();
  if (moverIds.length > 0) {
    const { data: movers } = await supabase
      .from("participants")
      .select("id, full_name")
      .in("id", moverIds);
    for (const m of movers ?? []) moverNameById.set(m.id, m.full_name);
  }

  // Any attached documents, one query, keyed by bill_id.
  const billIds = bills.map((b) => b.id);
  const { data: docsRaw, error: docsError } = await supabase
    .from("bill_documents")
    .select("bill_id, file_path, file_name")
    .in("bill_id", billIds);
  if (docsError) {
    return NextResponse.json({ error: docsError.message }, { status: 500 });
  }
  const docByBillId = new Map<
    string,
    { file_path: string; file_name: string }
  >();
  for (const d of docsRaw ?? []) {
    if (d.bill_id) docByBillId.set(d.bill_id, d);
  }

  const files: Zippable = {};
  const usedFolders = new Set<string>();
  const failures: string[] = [];
  let withDocument = 0;

  for (const bill of bills) {
    const moverName = bill.mover_participant_id
      ? (moverNameById.get(bill.mover_participant_id) ?? "Unknown Member")
      : "Unknown Member";
    const folder = dedupe(
      safeName(`${bill.title || "Untitled bill"} - ${moverName}`, "bill"),
      usedFolders
    );

    const provisions = clauseTexts(bill.provisions);
    const text = [
      "PRIVATE MEMBER'S BILL",
      `Member: ${moverName}`,
      `Status: ${bill.status ?? "drafting"}`,
      "",
      "TITLE",
      bill.title || "(untitled)",
      "",
      "OBJECTIVE",
      bill.objective || "(not filled in)",
      "",
      "PROBLEM STATEMENT",
      bill.problem_statement || "(not filled in)",
      "",
      "PROVISIONS",
      provisions.length > 0
        ? provisions.map((p, i) => `${i + 1}. ${p}`).join("\n")
        : "(none written)",
      "",
      "EXPECTED IMPACT",
      bill.expected_impact || "(not filled in)",
      "",
      "IMPLEMENTATION MECHANISM",
      bill.implementation || "(not filled in)",
      "",
    ].join("\n");

    files[`${folder}/bill.txt`] = strToU8(text);

    const doc = docByBillId.get(bill.id);
    if (doc) {
      const { data: blob, error: dlErr } = await supabase.storage
        .from(BUCKET)
        .download(doc.file_path);
      if (dlErr || !blob) {
        failures.push(
          `${folder}: attached document could not be read (${dlErr?.message ?? "not found in storage"})`
        );
      } else {
        withDocument++;
        files[`${folder}/${safeName(doc.file_name, "document")}`] =
          new Uint8Array(await blob.arrayBuffer());
      }
    }
  }

  const manifest = [
    "YIP — Private Member's Bills",
    `Bills: ${bills.length}`,
    `With an attached document: ${withDocument}`,
    `Form-only (no document attached): ${bills.length - withDocument}`,
    ...(failures.length
      ? ["", "COULD NOT BE READ:", ...failures.map((f) => `  ${f}`)]
      : []),
    "",
    "Every bill has a folder with bill.txt (its form fields) whether or not",
    "it also has an uploaded document — a form-only bill is not missing, it",
    "simply has no second file in its folder.",
  ].join("\n");
  files["_manifest.txt"] = strToU8(manifest);

  const zipped = zipSync(files, { level: 6 });

  return new Response(zipped as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="private-members-bills.zip"`,
      "Content-Length": String(zipped.length),
      "Cache-Control": "no-store",
    },
  });
}
