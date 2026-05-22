import Link from "next/link";
import type { ReactNode } from "react";

export function FormLayout({
  title,
  subtitle,
  backHref,
  children,
}: {
  title: string;
  subtitle?: string;
  backHref: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href={backHref}
          className="text-xs text-navy/50 hover:text-navy font-semibold tracking-widest uppercase"
        >
          ← Back
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-navy">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-sm text-navy/60">{subtitle}</p>
        )}
      </div>
      <div className="bg-white border border-navy/10 rounded-lg p-6">
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  name,
  type = "text",
  defaultValue = "",
  required = false,
  placeholder,
  hint,
  as = "input",
  rows,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  as?: "input" | "textarea";
  rows?: number;
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="block text-xs font-semibold uppercase tracking-widest text-navy/70"
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {as === "textarea" ? (
        <textarea
          id={name}
          name={name}
          rows={rows ?? 4}
          defaultValue={defaultValue}
          required={required}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-navy/20 rounded-md focus:border-yi-gold focus:outline-none focus:ring-2 focus:ring-yi-gold/20 text-sm text-navy"
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-navy/20 rounded-md focus:border-yi-gold focus:outline-none focus:ring-2 focus:ring-yi-gold/20 text-sm text-navy"
        />
      )}
      {hint && <p className="text-xs text-navy/50">{hint}</p>}
    </div>
  );
}

export function SubmitRow({
  submitLabel = "Save",
  cancelHref,
}: {
  submitLabel?: string;
  cancelHref: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-end gap-3 pt-4 border-t border-navy/10">
      <Link
        href={cancelHref}
        className="px-4 py-2 text-sm text-navy/60 hover:text-navy"
      >
        Cancel
      </Link>
      <button
        type="submit"
        className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
      >
        {submitLabel}
      </button>
    </div>
  );
}
