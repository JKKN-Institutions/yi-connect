import { useEffect } from "react";
import Link from "next/link";
import type { QuizResult } from "@/lib/yi-future/quiz";
import { fireConfetti } from "@/components/ui/confetti";
import { saveQuizResult } from "@/app/yi-future/actions/gamification";

type TrackMini = {
  slug: string;
  name: string;
  color_hex: string | null;
  icon: string | null;
  description: string | null;
};

export function QuizResultStep({
  result,
  track,
  tracks,
  onRetake,
  onHaveCode,
}: {
  result: QuizResult;
  track: TrackMini | null;
  tracks: TrackMini[];
  onRetake: () => void;
  onHaveCode: () => void;
}) {
  useEffect(() => {
    fireConfetti({ intensity: "normal" });
  }, []);

  // Persist quiz result if the user already has a delegate session.
  // The server action returns { ok: false, error: "no session" } for
  // pre-registered visitors — we swallow errors silently either way.
  useEffect(() => {
    void (async () => {
      try {
        await saveQuizResult({
          winner: result.winner,
          scores: result.scores,
        });
      } catch {
        // Non-critical: quiz result persistence is best-effort.
      }
    })();
  }, [result.winner, result.scores]);

  const color = track?.color_hex ?? "#1a1a3e";
  const icon = track?.icon ?? "✦";
  const name = track?.name ?? "Climate Change";

  // Compute second-place for "or also strong in" line
  const second = result.ordered[1];
  const secondTrack = tracks.find((t) => t.slug === second?.slug);

  return (
    <div className="max-w-xl mx-auto px-4 py-10 md:py-12 text-center">
      <div className="text-[11px] font-semibold tracking-widest text-yi-gold uppercase mb-3">
        Your Match
      </div>
      <h1 className="text-3xl md:text-4xl font-bold text-navy">
        You&apos;re built for
      </h1>

      <div
        className="mt-8 mx-auto max-w-md p-8 rounded-2xl border-2 bg-white shadow-xl relative overflow-hidden"
        style={{ borderColor: color + "55", boxShadow: `0 20px 60px -20px ${color}40` }}
      >
        {/* Halo */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ background: `radial-gradient(circle at center, ${color}, transparent 70%)` }}
        />
        <div className="relative">
          <div className="text-7xl md:text-8xl mb-4">{icon}</div>
          <div
            className="text-xs font-semibold tracking-[0.25em] uppercase mb-2"
            style={{ color }}
          >
            Track
          </div>
          <div className="text-3xl md:text-4xl font-extrabold text-navy leading-tight">
            {name}
          </div>
          {track?.description && (
            <p className="mt-4 text-sm text-navy/70 leading-relaxed">
              {track.description}
            </p>
          )}
        </div>
      </div>

      {secondTrack && second && second.score > 0 && (
        <p className="mt-5 text-sm text-navy/60">
          Also strong in{" "}
          <span
            className="font-semibold"
            style={{ color: secondTrack.color_hex ?? "#1a1a3e" }}
          >
            {secondTrack.name}
          </span>
        </p>
      )}

      <div className="mt-10 p-6 rounded-xl bg-navy text-ivory text-left">
        <div className="text-[11px] font-semibold tracking-widest text-yi-gold uppercase mb-2">
          What happens next
        </div>
        <div className="text-sm md:text-base leading-relaxed">
          Tell your nearest Yi chapter admin you&apos;re in for{" "}
          <span className="font-semibold text-yi-gold">{name}</span>. They&apos;ll
          issue you a 6-character access code — your passport to the 90-day
          journey.
        </div>
      </div>

      <div className="mt-6 flex flex-col md:flex-row gap-3 max-w-md mx-auto">
        <Link
          href="/yi-future/chapters"
          className="flex-1 py-3 px-5 rounded-xl bg-yi-gold text-navy font-semibold hover:bg-yi-gold-light transition-all text-center"
        >
          Find my chapter →
        </Link>
        <button
          type="button"
          onClick={onHaveCode}
          className="flex-1 py-3 px-5 rounded-xl bg-white border-2 border-navy text-navy font-semibold hover:bg-navy hover:text-ivory transition-all"
        >
          Register as delegate →
        </button>
      </div>

      <button
        type="button"
        onClick={onRetake}
        className="mt-6 text-xs text-navy/50 hover:text-navy underline"
      >
        Retake the quiz
      </button>
    </div>
  );
}
