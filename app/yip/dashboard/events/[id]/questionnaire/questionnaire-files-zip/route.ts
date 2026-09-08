// Download every handed-in FILE for one questionnaire post as a single ZIP,
// foldered by candidate (Director's choice — one folder per student, not one
// flat pile of files two candidates could collide in).
//
// Student Journalist candidates hand in their report as an uploaded document
// or a photo of a handwritten page rather than typed text (see
// lib/yip/questionnaire.ts's note on why the file path exists at all). An
// organiser can already open one file at a time from the marking screen —
// this is the "get all of them in one go" that scale needs (25 papers, 17
// waiting on a person to read them, on the SRTN event alone).
//
// Scoped to ONE post at a time, matching the screen (the questionnaire is
// worked one post at a time — see setQuestionnaireWindow's "ONE POST AT A
// TIME" rule) and never hardcoded to Journalist: any post that accepts a file
// (questionnaireAllowsFileUpload) can be asked for here by key.
//
// A Route Handler rather than a Server Action because the response IS a file
// (same reasoning as private-bills-zip and
// app/yi-future/national/admin/submission-export/download/route.ts).
//
// UNLIKE the bills zip: a candidate with no file gets NO folder and no
// synthesised text file. These are file-submission papers — an empty folder,
// or a folder holding only a "nothing here" placeholder, would be noise, not
// information. How many files this zip actually contains is stated in the
// UI (the post card's file count) and in this zip's own _manifest.txt.

import { NextResponse } from "next/server";
import { zipSync, strToU8, type Zippable } from "fflate";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import {
  isQuestionnairePostKey,
  parseAnswerFiles,
  questionnaireAllowsFileUpload,
  questionnairePostLabel,
} from "@/lib/yip/questionnaire";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Downloading + zipping several attachments takes longer than the default budget.
export const maxDuration = 300;

// Same private bucket the questionnaire file-upload actions use
// (app/yip/actions/questionnaire.ts keeps its own copy too — that file is
// "use server" and cannot export a plain constant, so this is not a stray
// duplicate, it is the only way a Route Handler can share the name).
const UPLOAD_BUCKET = "yip-questionnaire-uploads";

// Refuse to assemble something the box cannot reasonably buffer, with a
// sentence rather than an out-of-memory crash. Well above this event's 15 MB.
const MAX_BUNDLE_BYTES = 200 * 1024 * 1024;

type PgErr = { message: string } | null;
type SB = Awaited<ReturnType<typeof createServiceClient>>;
type Loose<T> = {
  select: (cols: string) => Loose<T>;
  eq: (col: string, val: unknown) => Loose<T>;
  in: (col: string, vals: readonly unknown[]) => Loose<T>;
  then: Promise<{ data: T[] | null; error: PgErr }>["then"];
};
function tbl<T>(sb: SB, name: string): Loose<T> {
  return (sb as unknown as { from: (t: string) => Loose<T> }).from(name);
}

type AttemptRow = {
  id: string;
  participant_id: string;
  submitted_at: string | null;
};
type AnswerRow = { attempt_id: string; files: unknown };

/** Path-safe name for a ZIP folder/file — no traversal, no illegal characters. */
function safeName(raw: string, fallback = "file"): string {
  const cleaned = raw
    .replace(/[^A-Za-z0-9 ._-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[ _.]+|[ _.]+$/g, "")
    .slice(0, 100);
  return cleaned || fallback;
}

/** Dedupe within a Set, appending " (2)", " (3)", … on collision. */
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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id: eventId } = await params;

  // Same read-level gate the single-file open action uses
  // (getQuestionnaireFileUrl) — downloading many is not a stronger action
  // than downloading one.
  const access = await getYipEventAccess(eventId);
  if (!access.canView) {
    return NextResponse.json(
      { error: "Not authorized to view this event" },
      { status: 403 }
    );
  }

  const postKey = new URL(req.url).searchParams.get("post");
  if (!postKey || !isQuestionnairePostKey(postKey)) {
    return NextResponse.json({ error: "Unknown post." }, { status: 400 });
  }
  if (!questionnaireAllowsFileUpload(postKey)) {
    return NextResponse.json(
      { error: `${questionnairePostLabel(postKey)} does not accept handed-in files.` },
      { status: 400 }
    );
  }

  const sb = await createServiceClient();

  const { data: attemptsRaw, error: attemptsError } = await tbl<AttemptRow>(
    sb,
    "questionnaire_attempts"
  )
    .select("id, participant_id, submitted_at")
    .eq("event_id", eventId)
    .eq("post_key", postKey);
  if (attemptsError) {
    return NextResponse.json({ error: attemptsError.message }, { status: 500 });
  }
  const attempts = attemptsRaw ?? [];
  if (attempts.length === 0) {
    return NextResponse.json(
      { error: `No one has attempted ${questionnairePostLabel(postKey)} yet.` },
      { status: 404 }
    );
  }

  const { data: answersRaw, error: answersError } = await tbl<AnswerRow>(
    sb,
    "questionnaire_answers"
  )
    .select("attempt_id, files")
    .in(
      "attempt_id",
      attempts.map((a) => a.id)
    );
  if (answersError) {
    return NextResponse.json({ error: answersError.message }, { status: 500 });
  }

  // Every handed-in file, keyed by the attempt (= candidate) it belongs to.
  const filesByAttempt = new Map<
    string,
    { path: string; name: string; size: number }[]
  >();
  let totalBytes = 0;
  for (const row of answersRaw ?? []) {
    const files = parseAnswerFiles(row.files);
    if (files.length === 0) continue;
    const list = filesByAttempt.get(row.attempt_id) ?? [];
    for (const f of files) {
      list.push({ path: f.path, name: f.name, size: f.size });
      totalBytes += f.size;
    }
    filesByAttempt.set(row.attempt_id, list);
  }

  const attemptsWithFiles = attempts.filter((a) => filesByAttempt.has(a.id));
  if (attemptsWithFiles.length === 0) {
    return NextResponse.json(
      {
        error: `Nobody has handed in a file for ${questionnairePostLabel(postKey)} yet — every answer so far is typed text only.`,
      },
      { status: 404 }
    );
  }

  if (totalBytes > MAX_BUNDLE_BYTES) {
    return NextResponse.json(
      {
        error: `This post's files total ${(totalBytes / 1024 / 1024).toFixed(0)}MB, over the ${MAX_BUNDLE_BYTES / 1024 / 1024}MB this can bundle in one go. Ask for help splitting the download.`,
      },
      { status: 413 }
    );
  }

  const { data: peopleRaw, error: peopleError } = await tbl<{
    id: string;
    full_name: string;
    constituency_number: number | null;
  }>(sb, "participants")
    .select("id, full_name, constituency_number")
    .in(
      "id",
      attemptsWithFiles.map((a) => a.participant_id)
    );
  if (peopleError) {
    return NextResponse.json({ error: peopleError.message }, { status: 500 });
  }
  const personById = new Map((peopleRaw ?? []).map((p) => [p.id, p]));

  const zipFiles: Zippable = {};
  const usedFolders = new Set<string>();
  const failures: string[] = [];
  let fileCount = 0;

  for (const attempt of attemptsWithFiles) {
    const person = personById.get(attempt.participant_id);
    // Constituency number is what keeps two same-named candidates apart —
    // the Director's own reason for asking for it here.
    const label = person?.constituency_number
      ? `${person.constituency_number} - ${person?.full_name ?? "Unknown"}`
      : (person?.full_name ?? `Candidate ${attempt.participant_id.slice(0, 8)}`);
    const folder = dedupe(safeName(label, "candidate"), usedFolders);

    const usedFileNames = new Set<string>();
    for (const f of filesByAttempt.get(attempt.id) ?? []) {
      const { data: blob, error: dlErr } = await sb.storage
        .from(UPLOAD_BUCKET)
        .download(f.path);
      if (dlErr || !blob) {
        failures.push(
          `${folder}/${f.name}: could not be read (${dlErr?.message ?? "not found in storage"})`
        );
        continue;
      }
      const entryName = dedupe(safeName(f.name, "file"), usedFileNames);
      zipFiles[`${folder}/${entryName}`] = new Uint8Array(await blob.arrayBuffer());
      fileCount++;
    }
  }

  if (fileCount === 0) {
    return NextResponse.json(
      { error: "None of this post's handed-in files could be read from storage." },
      { status: 500 }
    );
  }

  const manifest = [
    `YIP — ${questionnairePostLabel(postKey)} handed-in files`,
    `Papers on this post: ${attempts.length} (${attempts.filter((a) => a.submitted_at).length} submitted)`,
    `Candidates with a file: ${attemptsWithFiles.length}`,
    `Files in this download: ${fileCount}`,
    ...(failures.length
      ? ["", "COULD NOT BE READ:", ...failures.map((f) => `  ${f}`)]
      : []),
    "",
    "A candidate with no folder here typed their answer, or has not answered",
    "at all — they did not hand in a file, so there is nothing of this kind",
    "to include for them.",
  ].join("\n");
  zipFiles["_manifest.txt"] = strToU8(manifest);

  const zipped = zipSync(zipFiles, { level: 6 });
  const filename = `${safeName(questionnairePostLabel(postKey), "questionnaire")}-files.zip`;

  return new Response(zipped as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(zipped.length),
      "Cache-Control": "no-store",
    },
  });
}
