"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { manualAddRegistrant } from "./actions";

const labelCls = "block text-xs font-medium text-white/50 uppercase tracking-wide mb-1.5";
const inputCls =
  "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#FD7215]/50 focus:ring-1 focus:ring-[#FD7215]/30";

export function ManualAddForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<{ name: string; code: string } | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setAdded(null);
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("full_name") ?? "").trim();
    startTransition(async () => {
      const res = await manualAddRegistrant(formData);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setAdded({ name, code: res.accessCode });
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-5"
    >
      <p className="text-white/50 text-sm">
        Add a Yi member who isn&apos;t in the directory yet. This bypasses the
        members-only gate — use it only for a real member the system couldn&apos;t
        match. They&apos;ll get an access code to complete registration.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1">
          <label htmlFor="ma_full_name" className={labelCls}>
            Full name <span className="text-[#FD7215]">*</span>
          </label>
          <input
            id="ma_full_name"
            name="full_name"
            type="text"
            required
            placeholder="Member name"
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="ma_email" className={labelCls}>
            Email
          </label>
          <input
            id="ma_email"
            name="email"
            type="email"
            placeholder="member@example.com"
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="ma_phone" className={labelCls}>
            Phone
          </label>
          <input
            id="ma_phone"
            name="phone"
            type="tel"
            placeholder="9876543210"
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="text-sm px-4 py-2 rounded-lg bg-[#FD7215] text-white font-medium hover:bg-[#FD7215]/90 disabled:opacity-50 transition-colors"
        >
          {pending ? "Adding…" : "Add member"}
        </button>
        {error && <span className="text-red-300 text-sm">{error}</span>}
      </div>

      {added && (
        <div className="bg-[#229434]/10 border border-[#229434]/30 rounded-lg p-4">
          <p className="text-[#229434] text-sm font-medium">
            Added {added.name}.
          </p>
          <p className="text-white/60 text-sm mt-1">
            Access code:{" "}
            <span className="font-mono text-white text-base tracking-wider">
              {added.code}
            </span>
          </p>
          <p className="text-white/40 text-xs mt-1">
            Share this code so they can complete their registration.
          </p>
        </div>
      )}
    </form>
  );
}
