/**
 * Reusable URL-input row for a single deliverable artifact.
 * Used inside submission forms for Phase A/B/C.
 *
 * File-upload is deferred — for Future 6.0 we accept public share URLs
 * (Google Drive / Dropbox / OneDrive). Captains paste the link; admins
 * verify by clicking.
 */
export function DeliverableUpload({
  label,
  name,
  defaultValue,
  hint,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  hint?: string;
  required?: boolean;
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="block text-xs font-semibold uppercase tracking-widest text-navy/70"
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex items-start gap-2">
        <input
          id={name}
          name={name}
          type="url"
          defaultValue={defaultValue ?? ""}
          required={required}
          placeholder="https://drive.google.com/file/d/…"
          className="flex-1 px-3 py-2 border border-navy/20 rounded-md text-sm font-mono"
        />
        {defaultValue && (
          <a
            href={defaultValue}
            target="_blank"
            rel="noopener"
            className="flex-shrink-0 px-3 py-2 text-xs font-semibold text-navy/70 border border-navy/20 rounded-md hover:bg-navy/5"
          >
            Open
          </a>
        )}
      </div>
      {hint && <p className="text-xs text-navy/50">{hint}</p>}
    </div>
  );
}
