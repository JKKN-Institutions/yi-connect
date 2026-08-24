// Chapter-wise download of every uploaded submission file.
//
// The point is a white paper: the chapter's work has to be readable in one
// place before it can be summarised. Until uploads existed there was nothing to
// collect — every submission was a Google Drive link living in a student's own
// account — so this walks what has been uploaded since.
//
// A Route Handler rather than a Server Action because the response IS a file.
// A Server Action returns a value to the page and cannot stream bytes to a
// download, and its 10mb body limit applies to the way back too.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { requireFutureNationalAdmin } from "@/lib/yi-future/auth/require-access";
import { buildZip, type ZipEntry } from "@/lib/yi-future/zip";
import {
  SUBMISSION_BUCKET,
  safeFileName,
} from "@/lib/yi-future/submission-files";

export const dynamic = "force-dynamic";
// Downloading and zipping many files takes longer than the default budget.
export const maxDuration = 300;

/** Guard: refuse to assemble something the format cannot hold or the box
 *  cannot buffer, with a sentence rather than an out-of-memory crash. */
const MAX_BUNDLE_BYTES = 400 * 1024 * 1024;

type FileRow = {
  file_path: string;
  file_name: string;
  slot: string;
  size_bytes: number;
  submissions: {
    phase: string;
    teams: { team_name: string; chapter_id: string | null } | null;
  } | null;
};

export async function GET(req: Request): Promise<Response> {
  // Gate first: this hands over every student document in a chapter.
  await requireFutureNationalAdmin();

  const url = new URL(req.url);
  const chapterId = url.searchParams.get("chapter");
  if (!chapterId) {
    return NextResponse.json(
      { error: "Name a chapter to download." },
      { status: 400 }
    );
  }

  const svc = await createServiceClient();

  const { data: chapterRaw } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name")
    .eq("id", chapterId)
    .maybeSingle();
  const chapter = chapterRaw as { id: string; name: string } | null;
  if (!chapter) {
    return NextResponse.json(
      { error: "That chapter no longer exists." },
      { status: 404 }
    );
  }

  // future.submission_files is not in the generated types → loose client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rowsRaw, error } = await (svc as any)
    .schema("future")
    .from("submission_files")
    .select(
      "file_path, file_name, slot, size_bytes, submissions!inner(phase, teams!inner(team_name, chapter_id))"
    )
    .eq("submissions.teams.chapter_id", chapterId);

  if (error) {
    return NextResponse.json(
      { error: `Could not read the file list. ${error.message}` },
      { status: 500 }
    );
  }

  const rows = (rowsRaw as FileRow[] | null) ?? [];
  if (rows.length === 0) {
    return NextResponse.json(
      {
        error: `${chapter.name} has no uploaded files yet. Only files uploaded through the platform can be collected — submissions given as Google Drive links stay in the student's own account.`,
      },
      { status: 404 }
    );
  }

  const totalBytes = rows.reduce((n, r) => n + (r.size_bytes ?? 0), 0);
  if (totalBytes > MAX_BUNDLE_BYTES) {
    return NextResponse.json(
      {
        error: `${chapter.name} holds ${(totalBytes / 1024 / 1024).toFixed(
          0
        )}MB of files, over the ${MAX_BUNDLE_BYTES / 1024 / 1024}MB this can bundle in one go.`,
      },
      { status: 413 }
    );
  }

  // ─── Fetch every object ─────────────────────────────────────────────
  const entries: ZipEntry[] = [];
  const failures: string[] = [];

  for (const row of rows) {
    const team = row.submissions?.teams?.team_name ?? "Unknown team";
    const phase = (row.submissions?.phase ?? "phase").replace("phase_", "Phase ");
    const name = `${safeFileName(team)}/${phase} - ${row.slot} - ${row.file_name}`;

    const { data: blob, error: dlErr } = await (svc as unknown as {
      storage: {
        from: (b: string) => {
          download: (
            p: string
          ) => Promise<{ data: Blob | null; error: { message: string } | null }>;
        };
      };
    }).storage
      .from(SUBMISSION_BUCKET)
      .download(row.file_path);

    if (dlErr || !blob) {
      // Named in the manifest rather than silently dropped — a missing file is
      // exactly what someone assembling a white paper needs to know about.
      failures.push(`${name} (${dlErr?.message ?? "not found in storage"})`);
      continue;
    }
    entries.push({
      name,
      data: new Uint8Array(await blob.arrayBuffer()),
    });
  }

  // ─── A manifest so the AI has context, not just documents ───────────
  const manifest = [
    `Yi Future 6.0 — submitted files`,
    `Chapter: ${chapter.name}`,
    `Files: ${entries.length}${failures.length ? ` (${failures.length} could not be read)` : ""}`,
    ``,
    ...entries.map((e) => `  ${e.name}`),
    ...(failures.length
      ? ["", "COULD NOT BE READ:", ...failures.map((f) => `  ${f}`)]
      : []),
    ``,
    `Note: teams who submitted a Google Drive link instead of uploading a file`,
    `do not appear here — those documents live in the student's own account.`,
  ].join("\n");

  entries.unshift({
    name: "_manifest.txt",
    data: new TextEncoder().encode(manifest),
  });

  const zip = buildZip(entries);
  const filename = `${safeFileName(chapter.name)}-future6-submissions.zip`;

  return new Response(zip as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(zip.length),
      "Cache-Control": "no-store",
    },
  });
}
