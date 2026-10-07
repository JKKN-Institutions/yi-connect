"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { applyHealthCard, healthCardColumns, previewHealthCard, setManualLayer1 } from "../../../actions/admin-content";
import { ConfirmDialog, ResultLine } from "../../../_ui/client";
import { IconDownload, IconUpload } from "../../../_ui/icons";
import { HEALTH_CARD_EXTS, HEALTH_CARD_MAX_BYTES, extOf } from "../_lib/ist";
import { useAction } from "../_lib/use-action";

type FileLite = { id: string; name: string; when: string; by: string };
type ChapterScore = { id: string; name: string; region: string | null; score: number | null; source: "excel" | "manual" | null; when: string | null };
type Columns = { fileName: string; sheetName: string; columns: string[]; sample: string[][] };
type Preview = {
  matched: Array<{ rowNo: number; chapterName: string; score: number }>;
  unmatched: Array<{ rowNo: number; cell: string }>;
  skipped: Array<{ rowNo: number; chapterName: string; why: string }>;
  problems: string[];
  missingChapters: string[];
};

async function postJson(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch("/api/recognitions/health-card", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* fall through to the generic message */
  }
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "The upload failed. Try again.");
  return data;
}

function guess(columns: string[], words: string[]): number {
  const i = columns.findIndex((c) => words.some((w) => c.toLowerCase().includes(w)));
  return i;
}

export function HealthCardDesk({
  awardId,
  awardTitle,
  files,
  chapters,
}: {
  awardId: string;
  awardTitle: string;
  files: FileLite[];
  chapters: ChapterScore[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [cols, setCols] = useState<Columns | null>(null);
  const [chapterCol, setChapterCol] = useState(-1);
  const [scoreCol, setScoreCol] = useState(-1);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirm, setConfirm] = useState(false);
  const colAct = useAction();
  const prevAct = useAction();
  const applyAct = useAction();

  function openFile(id: string) {
    setFileId(id);
    setCols(null);
    setPreview(null);
    colAct.run(() => healthCardColumns(id), (r) => {
      if (r.success && r.data) {
        setCols(r.data);
        setChapterCol(guess(r.data.columns, ["chapter"]));
        setScoreCol(guess(r.data.columns, ["score", "total", "health"]));
        colAct.setResult(null);
      }
    });
  }

  async function upload(file: File) {
    setUploadMsg(null);
    const ext = extOf(file.name);
    if (!(HEALTH_CARD_EXTS as readonly string[]).includes(ext)) {
      setUploadMsg({ ok: false, text: "Upload an Excel file (.xlsx or .xls) or a .csv file." });
      return;
    }
    if (file.size > HEALTH_CARD_MAX_BYTES) {
      setUploadMsg({ ok: false, text: "That file is over 10 MB. Remove extra sheets or images and try again." });
      return;
    }
    setUploading(true);
    try {
      const start = await postJson({ step: "start", awardId, fileName: file.name, size: file.size });
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { error } = await supabase.storage
        .from("recognitions")
        .uploadToSignedUrl(String(start.path), String(start.token), file, { contentType: file.type || "application/octet-stream" });
      if (error) throw new Error("The file didn't upload. Check your connection and try again.");
      const finish = await postJson({ step: "finish", awardId, path: start.path, fileName: file.name });
      setUploadMsg({ ok: true, text: `Uploaded ${file.name}. Now choose the columns below.` });
      if (inputRef.current) inputRef.current.value = "";
      openFile(String(finish.fileId));
    } catch (e) {
      setUploadMsg({ ok: false, text: e instanceof Error ? e.message : "The upload failed. Try again." });
    } finally {
      setUploading(false);
    }
  }

  const scored = chapters.filter((c) => c.score !== null).length;

  return (
    <div className="rx-stack-lg">
      <section className="rx-plate rx-stack">
        <h2 className="rx-h2">Upload the {awardTitle} Health Card</h2>
        <div className="rx-row">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="rx-input"
            style={{ flex: "1 1 260px" }}
            aria-label="Health Card file"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          {uploading ? (
            <span className="rx-row rx-small" style={{ gap: 6 }}>
              <IconUpload size={16} /> Uploading…
            </span>
          ) : null}
        </div>
        <p className="rx-help">.xlsx, .xls or .csv, up to 10 MB. Only the first sheet is read; its first row must be the column headings.</p>
        <ResultLine result={uploadMsg} />

        {files.length > 0 ? (
          <div className="rx-ledger-wrap">
            <table className="rx-ledger">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Uploaded</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {files.map((f, i) => (
                  <tr key={f.id}>
                    <td>
                      {f.name}
                      {i === 0 ? <span className="rx-ad-mini"> · latest (evaluators see every file)</span> : null}
                    </td>
                    <td className="rx-small">
                      {f.when}
                      <div className="rx-ad-mini">by {f.by}</div>
                    </td>
                    <td>
                      <div className="rx-row" style={{ gap: 6, flexWrap: "nowrap" }}>
                        <a className="rx-btn rx-btn-quiet rx-btn-sm" href={`/api/recognitions/health-card/${f.id}`}>
                          <IconDownload size={14} /> Download
                        </a>
                        <button type="button" className="rx-btn rx-btn-sm" onClick={() => openFile(f.id)} disabled={colAct.pending}>
                          {fileId === f.id ? "Reading this file" : "Read scores"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rx-mute rx-small">No Health Card uploaded for this award yet.</p>
        )}
      </section>

      {fileId ? (
        <section className="rx-plate rx-stack">
          <h2 className="rx-h2">Read Layer 1 scores</h2>
          {colAct.pending ? <p className="rx-mute">Opening the file…</p> : null}
          <ResultLine result={colAct.result} />
          {cols ? (
            <>
              <p className="rx-small rx-mute">
                {cols.fileName} · sheet &ldquo;{cols.sheetName}&rdquo; · {cols.columns.length} columns. No column names are assumed; check both choices.
              </p>
              <div className="rx-ad-fields">
                <div>
                  <label className="rx-label" htmlFor="hc-chapter">Column with the chapter name</label>
                  <select id="hc-chapter" className="rx-select" value={chapterCol} onChange={(e) => { setChapterCol(Number(e.target.value)); setPreview(null); }}>
                    <option value={-1}>Choose a column</option>
                    {cols.columns.map((c, i) => (
                      <option key={i} value={i}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="rx-label" htmlFor="hc-score">Column with the 0-100 score</label>
                  <select id="hc-score" className="rx-select" value={scoreCol} onChange={(e) => { setScoreCol(Number(e.target.value)); setPreview(null); }}>
                    <option value={-1}>Choose a column</option>
                    {cols.columns.map((c, i) => (
                      <option key={i} value={i}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              {cols.sample.length > 0 ? (
                <details className="rx-ad-details">
                  <summary>First rows of the sheet</summary>
                  <div className="rx-ledger-wrap">
                    <table className="rx-ledger">
                      <thead>
                        <tr>{cols.columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {cols.sample.map((r, i) => (
                          <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ) : null}
              <div className="rx-row">
                <button
                  type="button"
                  className="rx-btn rx-btn-quiet"
                  disabled={prevAct.pending || chapterCol < 0 || scoreCol < 0}
                  onClick={() =>
                    prevAct.run(() => previewHealthCard({ fileId, chapterCol, scoreCol }), (r) => {
                      if (r.success && r.data) {
                        setPreview(r.data);
                        prevAct.setResult(null);
                      }
                    })
                  }
                >
                  {prevAct.pending ? "Checking…" : "Preview matches"}
                </button>
                {preview ? (
                  <button
                    type="button"
                    className="rx-btn"
                    disabled={applyAct.pending || preview.problems.length > 0 || preview.matched.length === 0}
                    onClick={() => setConfirm(true)}
                  >
                    Apply scores
                  </button>
                ) : null}
              </div>
              <ResultLine result={prevAct.result} />
              <ResultLine result={applyAct.result} />
              {preview ? <PreviewView p={preview} /> : null}
              <ConfirmDialog
                open={confirm}
                title={`Apply ${preview?.matched.length ?? 0} Layer 1 scores?`}
                confirmLabel="Apply scores"
                busy={applyAct.pending}
                onClose={() => setConfirm(false)}
                onConfirm={() =>
                  applyAct.run(() => applyHealthCard({ fileId, chapterCol, scoreCol }), (r) => {
                    if (r.success) {
                      setConfirm(false);
                      setPreview(null);
                    }
                  })
                }
              >
                <p>
                  Each matched chapter&apos;s Layer 1 score for {awardTitle} is replaced with the value in the file, including scores typed by hand.
                  Chapters not in the file keep what they have.
                </p>
              </ConfirmDialog>
            </>
          ) : null}
        </section>
      ) : null}

      <ManualScores awardId={awardId} chapters={chapters} scored={scored} />
    </div>
  );
}

function PreviewView({ p }: { p: Preview }) {
  return (
    <div className="rx-stack">
      {p.problems.length > 0 ? (
        <div className="rx-notice rx-notice-alert">
          <strong>Fix these rows in the file and upload it again:</strong>
          <ul style={{ margin: "6px 0 0 18px" }}>
            {p.problems.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rx-notice rx-notice-ok">
          {p.matched.length} chapter{p.matched.length === 1 ? "" : "s"} matched and ready to apply.
        </div>
      )}
      {p.unmatched.length > 0 ? (
        <div className="rx-notice">
          <strong>{p.unmatched.length} row{p.unmatched.length === 1 ? "" : "s"} didn&apos;t match an active chapter</strong> (skipped):{" "}
          {p.unmatched.slice(0, 30).map((u) => `row ${u.rowNo} "${u.cell}"`).join(", ")}
          {p.unmatched.length > 30 ? ` …and ${p.unmatched.length - 30} more` : ""}. Fix the spelling in the file, or enter those scores by hand below.
        </div>
      ) : null}
      {p.skipped.length > 0 ? (
        <p className="rx-small rx-mute">
          Skipped, no score: {p.skipped.map((s) => `${s.chapterName} (row ${s.rowNo})`).join(", ")}.
        </p>
      ) : null}
      {p.missingChapters.length > 0 ? (
        <details className="rx-ad-details">
          <summary>{p.missingChapters.length} active chapters are not in this file</summary>
          <p className="rx-small">{p.missingChapters.join(", ")}</p>
        </details>
      ) : null}
      {p.matched.length > 0 ? (
        <div className="rx-ledger-wrap">
          <table className="rx-ledger">
            <thead>
              <tr>
                <th className="rx-num">Row</th>
                <th>Chapter</th>
                <th className="rx-num">Score</th>
              </tr>
            </thead>
            <tbody>
              {p.matched.map((m) => (
                <tr key={m.rowNo}>
                  <td className="rx-num">{m.rowNo}</td>
                  <td>{m.chapterName}</td>
                  <td className="rx-num">{m.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function ManualScores({ awardId, chapters, scored }: { awardId: string; chapters: ChapterScore[]; scored: number }) {
  const [chapterId, setChapterId] = useState("");
  const [score, setScore] = useState("");
  const [filter, setFilter] = useState("");
  const { pending, result, run } = useAction();
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? chapters.filter((c) => c.name.toLowerCase().includes(f)) : chapters;
  }, [chapters, filter]);

  return (
    <section className="rx-stack">
      <div className="rx-spread">
        <div>
          <h2 className="rx-h2">Layer 1 scores now</h2>
          <p className="rx-small rx-mute">
            {scored} of {chapters.length} chapters have a score. A missing score counts as 0 in the combined matrix and is flagged there.
          </p>
        </div>
      </div>

      <form
        className="rx-plate rx-stack"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => setManualLayer1({ awardId, chapterId, score }), (r) => r.success && setScore(""));
        }}
      >
        <div className="rx-h3">Correct one chapter by hand</div>
        <div className="rx-ad-fields">
          <div>
            <label className="rx-label" htmlFor="ml-chapter">Chapter</label>
            <select id="ml-chapter" className="rx-select" value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
              <option value="">Choose a chapter</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.score !== null ? ` (now ${c.score})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="rx-label" htmlFor="ml-score">Score (0-100)</label>
            <input id="ml-score" className="rx-input rx-num" inputMode="decimal" value={score} onChange={(e) => setScore(e.target.value)} placeholder="e.g. 72.5" />
          </div>
        </div>
        <div>
          <button type="submit" className="rx-btn" disabled={pending || chapterId === "" || score.trim() === ""}>
            {pending ? "Saving…" : "Save score"}
          </button>
        </div>
        <ResultLine result={result} />
      </form>

      <input className="rx-input" style={{ maxWidth: 260 }} placeholder="Find a chapter" aria-label="Find a chapter" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div className="rx-ledger-wrap">
        <table className="rx-ledger">
          <thead>
            <tr>
              <th>Chapter</th>
              <th>Region</th>
              <th className="rx-num">Layer 1</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className="rx-num">{c.region ?? "—"}</td>
                <td className="rx-num">{c.score === null ? "—" : c.score}</td>
                <td className="rx-small">
                  {c.source === "excel" ? "Health Card file" : c.source === "manual" ? "Typed by hand" : <span className="rx-mute">No score</span>}
                  {c.when ? <div className="rx-ad-mini">{c.when}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
