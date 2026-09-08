// Shared contract for uploaded submission files.
//
// Lives in lib/ rather than beside the server action because a "use server"
// file may export ONLY async functions — a type or a constant exported from one
// breaks the Vercel build.

/** Private bucket holding every uploaded deliverable. Never public: reads are
 *  short-lived signed URLs minted server-side. */
export const SUBMISSION_BUCKET = "future-submissions";

/** The six deliverable slots, mirroring the *_url columns on submissions. */
export const SUBMISSION_SLOTS = [
  "problem_definition",
  "draft_solution",
  "final_policy_document",
  "final_execution_plan",
  "final_scalability_model",
  "final_presentation_deck",
] as const;

export type SubmissionSlot = (typeof SUBMISSION_SLOTS)[number];

export function isSubmissionSlot(value: string): value is SubmissionSlot {
  return (SUBMISSION_SLOTS as readonly string[]).includes(value);
}

/**
 * Upload ceiling. Server Actions are configured at 10mb in next.config.ts and
 * the whole file crosses that boundary, so this MUST stay under it — a larger
 * file is rejected by the framework before any of our code runs, which shows
 * the student a blank failure instead of a sentence.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Accepted types. Deliberately narrow: these are policy documents and decks,
 * and a narrow list is what lets the white-paper export assume it can read
 * what it finds. Links remain available for anything else — video, a living
 * Google Doc, a 200MB dataset.
 */
export const ACCEPTED_UPLOAD_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/msword": ".doc",
  "application/vnd.ms-powerpoint": ".ppt",
};

export const ACCEPT_ATTRIBUTE = ".pdf,.pptx,.docx,.doc,.ppt";

export type SubmissionFileRow = {
  id: string;
  submission_id: string;
  slot: SubmissionSlot;
  file_path: string;
  file_name: string;
  size_bytes: number;
  content_type: string | null;
  uploaded_at: string;
};

/** Human-readable size, for a student deciding whether their file is too big. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Strip anything that would make a storage key or a ZIP entry awkward. */
export function safeFileName(raw: string): string {
  return (
    raw
      .replace(/[^A-Za-z0-9._-]/g, "_")
      .replace(/_{2,}/g, "_")
      .slice(-120) || "file"
  );
}
