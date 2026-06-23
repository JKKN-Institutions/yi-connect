import { FileText, Download, ExternalLink } from "lucide-react";

const PDF_URL = "/yi-future/sop/future-6-solution-submission-format.pdf";
const DOCX_URL = "/yi-future/sop/future-6-solution-submission-format.docx";

/**
 * Future 6.0 — Solution Submission Format (SOP) download card.
 *
 * One static document served from /public, offered two ways: "View PDF" opens
 * it inline (best on phones), "Download Word" saves the editable original.
 * Used on the delegate submission form and the chapter/national admin areas so
 * everyone references the same official format.
 */
export function SopDownloadCard({
  className = "",
  note,
}: {
  className?: string;
  /** Optional extra line (e.g. an admin-facing "share this with your teams"). */
  note?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[#F5A623]/40 bg-[#FFF8EC] p-4 sm:p-5 ${className}`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="shrink-0 grid place-items-center size-10 sm:size-11 rounded-lg bg-[#1a1a3e] text-[#F5A623]">
          <FileText className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[#F5A623]">
            Future 6.0 · Official format
          </div>
          <h3 className="mt-0.5 text-base font-bold text-[#1a1a3e]">
            Solution Submission Format (SOP)
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-[#1a1a3e]/70">
            The exact structure every team must follow — what to submit, section
            by section, and how each part is scored against the national rubric
            (100 marks, qualifying threshold 70). Read this before you build your
            submission.
          </p>
          {note ? (
            <p className="mt-1.5 text-xs font-medium text-[#1a1a3e]/60">{note}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={PDF_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1a3e] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2d2d5c] transition-colors"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              View PDF
            </a>
            <a
              href={DOCX_URL}
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1a1a3e]/20 bg-white px-3.5 py-2 text-xs font-semibold text-[#1a1a3e] hover:border-[#1a1a3e]/40 transition-colors"
            >
              <Download className="size-3.5" aria-hidden />
              Download Word
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
