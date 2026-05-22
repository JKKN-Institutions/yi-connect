"use client";

import { useRef, useState, useTransition } from "react";
import type {
  AddChairResult,
  ChapterOption,
} from "@/app/yi-future/actions/chapter-chairs";

interface Props {
  chapters: ChapterOption[];
  action: (formData: FormData) => Promise<AddChairResult>;
  year: number;
}

export function AddChairForm({ chapters, action, year }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<
    { type: "ok" | "err"; text: string } | null
  >(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const res = await action(formData);
      if (res.ok) {
        setMessage({
          type: "ok",
          text: `Added ${res.email} as ${res.role === "chapter_chair" ? "Chair" : "Co-Chair"}.`,
        });
        formRef.current?.reset();
      } else {
        setMessage({ type: "err", text: res.error });
      }
    });
  }

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-navy px-3 py-2 text-xs font-semibold text-white hover:bg-navy/90"
        >
          + Add Chair / Co-Chair
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-navy/15 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-navy">
          Add Chair or Co-Chair{" "}
          <span className="text-navy/50 font-normal">· Yi Year {year}</span>
        </h3>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setMessage(null);
          }}
          className="text-xs text-navy/50 hover:text-navy"
        >
          Cancel
        </button>
      </div>

      <form ref={formRef} action={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-xs space-y-1">
          <span className="text-navy/70 font-medium">Chapter *</span>
          <select
            name="chapter_id"
            required
            className="block w-full rounded-md border border-navy/15 px-2 py-1.5 text-sm bg-white"
          >
            <option value="">Pick a chapter…</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.region ? ` (${c.region})` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs space-y-1">
          <span className="text-navy/70 font-medium">Role *</span>
          <select
            name="role"
            required
            defaultValue="chapter_chair"
            className="block w-full rounded-md border border-navy/15 px-2 py-1.5 text-sm bg-white"
          >
            <option value="chapter_chair">Chair</option>
            <option value="chapter_co_chair">Co-Chair</option>
          </select>
        </label>

        <label className="text-xs space-y-1">
          <span className="text-navy/70 font-medium">Full name *</span>
          <input
            name="full_name"
            type="text"
            required
            minLength={2}
            placeholder="e.g. Priya Sharma"
            className="block w-full rounded-md border border-navy/15 px-2 py-1.5 text-sm"
          />
        </label>

        <label className="text-xs space-y-1">
          <span className="text-navy/70 font-medium">Email *</span>
          <input
            name="email"
            type="email"
            required
            placeholder="chair@example.com"
            className="block w-full rounded-md border border-navy/15 px-2 py-1.5 text-sm font-mono"
          />
        </label>

        <label className="text-xs space-y-1 md:col-span-2">
          <span className="text-navy/70 font-medium">Phone (optional)</span>
          <input
            name="phone"
            type="tel"
            placeholder="+91 9xxxxxxxxx"
            className="block w-full rounded-md border border-navy/15 px-2 py-1.5 text-sm"
          />
        </label>

        <div className="md:col-span-2 flex items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-navy/50">
            Login account isn&apos;t auto-created. Run{" "}
            <code className="font-mono">scripts/seed_chapter_chairs.py</code>{" "}
            to send credentials.
          </p>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-yi-saffron px-3 py-1.5 text-xs font-semibold text-white hover:bg-yi-saffron/90 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Add to directory"}
          </button>
        </div>
      </form>

      {message && (
        <div
          className={
            message.type === "ok"
              ? "rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800"
              : "rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800"
          }
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
