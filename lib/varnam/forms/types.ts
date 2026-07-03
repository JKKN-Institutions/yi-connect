/**
 * Varnam Vizha per-event registration form fields. Organisers design extra
 * sign-up questions in the dashboard; they're stored as JSONB on
 * yi_connect.events.registration_form_fields and rendered on the public
 * registration form. Modeled on the JKKN-Event-Form FormField[] pattern,
 * simplified (no drag-drop — up/down ordering).
 */

export const VARNAM_FORM_FIELD_TYPES = [
  "text",
  "phone",
  "textarea",
  "select",
  "checkbox",
] as const;

export type VarnamFormField = {
  id: string;
  type: "text" | "phone" | "textarea" | "select" | "checkbox";
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
};

/** Hard cap on extra questions per event (name/email/phone are always collected). */
export const MAX_FORM_FIELDS = 12;

const MAX_LABEL_LEN = 120;
const MAX_OPTIONS = 20;

function isFieldType(v: unknown): v is VarnamFormField["type"] {
  return (
    typeof v === "string" &&
    (VARNAM_FORM_FIELD_TYPES as readonly string[]).includes(v)
  );
}

/**
 * Defensive parse of raw JSONB into a clean VarnamFormField[]. Returns [] when
 * raw isn't an array; drops any item that isn't valid-shaped. Clamps labels to
 * 120 chars and options to 20 items — never trust stored or client data.
 */
export function parseFormFields(raw: unknown): VarnamFormField[] {
  if (!Array.isArray(raw)) return [];
  const out: VarnamFormField[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null || Array.isArray(item))
      continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || o.id.trim() === "") continue;
    if (!isFieldType(o.type)) continue;
    if (typeof o.label !== "string") continue;

    const field: VarnamFormField = {
      id: o.id.slice(0, 64),
      type: o.type,
      label: o.label.trim().slice(0, MAX_LABEL_LEN),
      required: o.required === true,
    };
    if (typeof o.placeholder === "string" && o.placeholder.trim() !== "") {
      field.placeholder = o.placeholder.trim().slice(0, MAX_LABEL_LEN);
    }
    if (Array.isArray(o.options)) {
      field.options = o.options
        .filter((x): x is string => typeof x === "string" && x.trim() !== "")
        .map((x) => x.trim().slice(0, MAX_LABEL_LEN))
        .slice(0, MAX_OPTIONS);
    }
    out.push(field);
    if (out.length >= MAX_FORM_FIELDS) break; // backstop; the save action enforces this too
  }
  return out;
}
