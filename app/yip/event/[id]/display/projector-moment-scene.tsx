"use client";

/**
 * PROJECTOR AI MOMENT — the venue-screen renderer for director-curated AI
 * scenes (yip.projector_moments).
 *
 * Read path: the anon kiosk client polls the one currently-projected row
 * (RLS: anon may see status='projected' only). Content was built SERVER-SIDE
 * at Project time — quotes are verbatim copies of members' own questions;
 * text scenes passed the director's review + a no-digits gate. This component
 * only renders; it never composes text.
 *
 * Layouts:
 *   • quotes  — one big Playfair quote at a time, auto-rotating every 12s,
 *               with the member's name + constituency + ministry chip.
 *   • lines   — centered headline lines (bill bullets / themes / framing).
 */
import { useEffect, useState } from "react";
import { createClient } from "@/lib/yip/supabase/client";
import type { ProjectorMomentRow } from "@/lib/yip/ai/types";

/** Poll the currently-projected moment for the event (anon-safe). */
export function useProjectedMoment(eventId: string): ProjectorMomentRow | null {
  const [moment, setMoment] = useState<ProjectorMomentRow | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function poll() {
      try {
        // projector_moments is not in the generated types → loose cast.
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        const { data } = await (supabase as any)
          .from("projector_moments")
          .select("*")
          .eq("event_id", eventId)
          .eq("status", "projected")
          .order("updated_at", { ascending: false })
          .limit(1);
        if (!cancelled) {
          setMoment(((data as ProjectorMomentRow[]) ?? [])[0] ?? null);
        }
      } catch {
        // transient — keep the last known state
      }
    }

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [eventId]);

  return moment;
}

export function ProjectorMomentScene({
  moment,
}: {
  moment: ProjectorMomentRow;
}) {
  const quotes = moment.payload.quotes ?? null;
  const lines = moment.payload.lines ?? null;

  // Rotate quotes every 12 seconds.
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
    if (!quotes || quotes.length <= 1) return;
    const t = setInterval(
      () => setIdx((i) => (i + 1) % quotes.length),
      12000
    );
    return () => clearInterval(t);
  }, [moment.id, quotes]);

  return (
    <div className="w-full max-w-6xl space-y-10 text-center">
      {/* Scene heading */}
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-3">
          <div className="h-px w-16 bg-[#FF9933]/60" />
          <p className="text-sm uppercase tracking-[0.35em] text-[#FF9933] font-semibold">
            {moment.payload.title}
          </p>
          <div className="h-px w-16 bg-[#FF9933]/60" />
        </div>
        {moment.payload.subtitle && (
          <p className="text-lg text-gray-400">{moment.payload.subtitle}</p>
        )}
      </div>

      {/* Quote carousel — members' own words, verbatim */}
      {quotes && quotes.length > 0 && (
        <div key={idx} className="space-y-8 yip-winner-pop">
          <p
            className="mx-auto max-w-5xl font-serif text-4xl leading-snug text-white lg:text-5xl"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            &ldquo;{quotes[idx].text}&rdquo;
          </p>
          <div className="space-y-1">
            <p className="text-2xl font-semibold text-amber-300">
              {quotes[idx].name}
            </p>
            <p className="text-lg text-gray-400">
              {[quotes[idx].constituency, quotes[idx].ministry]
                .filter(Boolean)
                .join("  ·  ")}
            </p>
          </div>
          {quotes.length > 1 && (
            <div className="flex items-center justify-center gap-2">
              {quotes.map((_, i) => (
                <span
                  key={i}
                  className={
                    i === idx
                      ? "size-2 rounded-full bg-[#FF9933]"
                      : "size-2 rounded-full bg-white/20"
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Headline lines — bill bullets / House themes / session framing */}
      {!quotes?.length && lines && lines.length > 0 && (
        <div className="mx-auto max-w-5xl space-y-6">
          {lines.map((line, i) => (
            <p
              key={i}
              className="text-3xl font-semibold leading-snug text-white lg:text-4xl"
            >
              {line}
            </p>
          ))}
        </div>
      )}

      <p className="text-xs uppercase tracking-[0.3em] text-white/30">
        AI-curated · reviewed by the organisers
      </p>
    </div>
  );
}
