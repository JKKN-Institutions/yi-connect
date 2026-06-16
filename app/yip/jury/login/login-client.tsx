"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { juryLoginByEmail } from "@/app/yip/actions/auth";

type EventOption = {
  id: string;
  name: string;
  chapter_name: string | null;
  level: string;
  day1_date: string;
};

function formatLevel(level: string): string {
  if (level === "chapter") return "Chapter";
  if (level === "regional") return "Regional";
  if (level === "national") return "National";
  return level;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function JuryLoginClient({ events }: { events: EventOption[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [eventId, setEventId] = useState("");
  const [chapterFilter, setChapterFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filteredEvents = useMemo(() => {
    if (!chapterFilter.trim()) return events;
    const q = chapterFilter.trim().toLowerCase();
    return events.filter((e) => {
      const inName = e.name.toLowerCase().includes(q);
      const inChapter = (e.chapter_name ?? "").toLowerCase().includes(q);
      return inName || inChapter;
    });
  }, [events, chapterFilter]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Defensive DOM read: automation tools (e.g. chrome-extension form_input) set
    // the native .value directly without firing React's onChange, leaving controlled
    // state empty. Fall back to the DOM's current value so both paths work.
    const form = e.currentTarget;
    const resolvedEmail =
      email.trim() ||
      (form.elements.namedItem("jury-email") as HTMLInputElement | null)?.value?.trim() ||
      "";
    const resolvedEventId =
      eventId ||
      (form.elements.namedItem("jury-event") as HTMLSelectElement | null)?.value ||
      "";

    if (!resolvedEmail || !resolvedEventId) return;

    setError(null);
    setLoading(true);

    try {
      const result = await juryLoginByEmail(resolvedEmail, resolvedEventId);
      if (result.type === "ok") {
        router.push("/yip/jury");
      } else {
        setError(result.message);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FEFCF6]">
      {/* Tricolor top bar */}
      <div className="flex h-1.5">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#138808]" />
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 py-12">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[400px] w-[400px] rounded-full bg-[#FF9933]/[0.04] blur-3xl" />

        <div className="relative w-full max-w-md">
          {/* Logo removed 2026-06-16 — re-add later */}
          <div className="mb-8 text-center">
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[#1a1a3e]">
              Jury Sign-In
            </h1>
            <p className="mt-1.5 text-sm text-[#1a1a3e]/40">
              Young Indians Parliament
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#1a1a3e]/5 bg-white shadow-xl shadow-[#1a1a3e]/5">
            <div className="p-6 sm:p-8">
              <form method="post" action="#" onSubmit={handleSubmit} className="space-y-5">
                {/* Email */}
                <div>
                  <label
                    htmlFor="jury-email"
                    className="block text-sm font-medium text-[#1a1a3e]"
                  >
                    Your email
                  </label>
                  <input
                    id="jury-email"
                    name="jury-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    className="mt-2 h-12 w-full rounded-xl border-2 border-[#1a1a3e]/10 bg-[#FEFCF6] px-4 text-base text-[#1a1a3e] transition-colors focus:border-[#FF9933] focus:outline-none focus:ring-4 focus:ring-[#FF9933]/10 placeholder:text-[#1a1a3e]/30"
                    required
                  />
                </div>

                {/* Chapter / event search */}
                <div>
                  <label
                    htmlFor="jury-chapter-search"
                    className="block text-sm font-medium text-[#1a1a3e]"
                  >
                    Find your chapter
                  </label>
                  <input
                    id="jury-chapter-search"
                    type="text"
                    placeholder="Type chapter or event name (e.g. Mizoram)"
                    value={chapterFilter}
                    onChange={(e) => setChapterFilter(e.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border-2 border-[#1a1a3e]/10 bg-[#FEFCF6] px-4 text-sm text-[#1a1a3e] transition-colors focus:border-[#FF9933] focus:outline-none focus:ring-4 focus:ring-[#FF9933]/10 placeholder:text-[#1a1a3e]/30"
                  />
                </div>

                {/* Event dropdown */}
                <div>
                  <label
                    htmlFor="jury-event"
                    className="block text-sm font-medium text-[#1a1a3e]"
                  >
                    Select event
                  </label>
                  <select
                    id="jury-event"
                    name="jury-event"
                    value={eventId}
                    onChange={(e) => {
                      setEventId(e.target.value);
                      setError(null);
                    }}
                    className="mt-2 h-12 w-full rounded-xl border-2 border-[#1a1a3e]/10 bg-[#FEFCF6] px-3 text-base text-[#1a1a3e] transition-colors focus:border-[#FF9933] focus:outline-none focus:ring-4 focus:ring-[#FF9933]/10"
                    required
                  >
                    <option value="">— Choose an event —</option>
                    {filteredEvents.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name} · {ev.chapter_name ?? "—"} ·{" "}
                        {formatLevel(ev.level)} · {formatDate(ev.day1_date)}
                      </option>
                    ))}
                  </select>
                  {filteredEvents.length === 0 && (
                    <p className="mt-1 text-xs text-[#1a1a3e]/40">
                      No events match that search.
                    </p>
                  )}
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim() || !eventId}
                  className="flex h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-[#FF9933] text-base font-semibold text-white shadow-lg shadow-[#FF9933]/25 transition-all hover:bg-[#E68A2E] hover:shadow-xl disabled:opacity-50 disabled:shadow-none"
                >
                  {loading ? (
                    <svg
                      className="size-5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="size-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  )}
                  {loading ? "Signing in..." : "Start Scoring"}
                </button>
              </form>
            </div>

            <div className="flex h-1">
              <div className="flex-1 bg-[#FF9933]" />
              <div className="flex-1 bg-white" />
              <div className="flex-1 bg-[#138808]" />
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-[#1a1a3e]/35">
            Have an access code instead?{" "}
            <Link
              href="/yip/join"
              className="font-medium text-[#FF9933] hover:underline"
            >
              Use code login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
