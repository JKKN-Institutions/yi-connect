// ═══════════════════════════════════════════════════════════════════════
// Shared contract for the chapter delegate bulk import.
//
// Lives in lib/ rather than beside the server action because a "use server"
// file may export ONLY async functions — exporting a type or a constant from
// one breaks the Vercel build.
// ═══════════════════════════════════════════════════════════════════════

/** Columns the template emits, in order. Mirrors /chapter/delegates/new. */
export const TEMPLATE_COLUMNS = [
  "Full Name",
  "Email",
  "Phone",
  "College",
  "Course",
  "Year of Study",
  "Age",
  "Home State",
] as const;

/** One example row so the shape is obvious when the file opens in Excel. */
export const TEMPLATE_EXAMPLE = [
  "Priya Raman",
  "priya.raman@example.com",
  "9876543210",
  "Kongu Engineering College",
  "B.Tech",
  "2",
  "19",
  "TN",
] as const;

/**
 * Accepted header spellings per field. Organisers rename columns constantly;
 * matching by alias means an ordinary chapter spreadsheet imports without
 * anyone having to reformat it first.
 */
export const COLUMN_ALIASES: Record<string, string[]> = {
  full_name: ["full name", "name", "student name", "delegate name", "fullname"],
  email: ["email", "email address", "e mail", "mail", "email id"],
  phone: ["phone", "mobile", "mobile number", "phone number", "contact", "whatsapp"],
  college: ["college", "college name", "institution", "school", "university"],
  course: ["course", "degree", "programme", "program", "branch"],
  year_of_study: ["year of study", "year", "study year", "current year"],
  age: ["age"],
  home_state: ["home state", "state"],
};

/**
 * Rows sent to the server per call. Small enough that a chunk stays inside the
 * function timeout — the per-row Supabase Auth call is the slow part — and far
 * below the server-action body limit.
 */
export const IMPORT_CHUNK_SIZE = 100;

/** Refused above this, with a message rather than a silent truncation. */
export const MAX_IMPORT_ROWS = 2000;

/** A validated row as it crosses the wire. Every field but the name is optional. */
export type ImportDelegateRow = {
  full_name: string;
  email?: string;
  phone?: string;
  college?: string;
  course?: string;
  year_of_study?: number;
  age?: number;
  home_state?: string;
};

/** A delegate actually created — carries the code so it can be handed out. */
export type ImportedDelegate = {
  full_name: string;
  email: string;
  phone: string;
  college: string;
  access_code: string;
};

export type ImportChunkResult =
  | {
      ok: true;
      /** Rows inserted. */
      added: number;
      /** Rows skipped because that email or phone is already in this edition. */
      skipped: number;
      /** Inserted, but the college name matched nothing — left unlinked. */
      collegeNotMatched: string[];
      /**
       * Names of rows REFUSED because they had neither an email nor a phone.
       * Every duplicate check is keyed on one of those two, so such a row
       * cannot be checked and would be created afresh on every re-upload.
       */
      unverifiable: string[];
      /** Human-readable problems, addressed by name. */
      errors: string[];
      created: ImportedDelegate[];
    }
  | { ok: false; error: string };
