import { useEffect, useState } from "react";
import { fireConfetti } from "@/components/ui/confetti";
import { CountUp } from "@/components/ui/count-up";
import type { DelegateContext } from "@/app/yi-future/actions/gamification";

export function IdentityRevealStep({
  ctx,
  onContinue,
}: {
  ctx: DelegateContext;
  onContinue: () => void;
}) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => {
      setRevealed(true);
      fireConfetti({ intensity: "normal" });
    }, 300);
    return () => clearTimeout(t1);
  }, []);

  const trackColor = ctx.track_color ?? "#F5A623";

  return (
    <div className="max-w-xl mx-auto px-4 py-10 md:py-14 text-center">
      <div
        className={`transition-all duration-700 ${
          revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <div className="text-[11px] font-semibold tracking-widest text-yi-gold uppercase mb-3">
          ⚡ Welcome to Future 6.0
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-navy tracking-tight leading-tight">
          Hello, {ctx.full_name.split(" ")[0]}.
        </h1>
        <p className="mt-3 text-base text-navy/70">
          You&apos;re officially in. Here&apos;s your delegate card.
        </p>
      </div>

      {/* The delegate card */}
      <div
        className={`mt-10 mx-auto max-w-md rounded-2xl overflow-hidden shadow-2xl transition-all duration-700 delay-200 ${
          revealed ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
        style={{ boxShadow: `0 20px 50px -20px ${trackColor}60` }}
      >
        {/* Card header strip */}
        <div
          className="h-2"
          style={{ background: `linear-gradient(90deg, ${trackColor}, #1a1a3e)` }}
        />
        <div className="bg-white p-6 text-left">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-[10px] font-semibold tracking-widest text-navy/50 uppercase mb-1">
                Delegate
              </div>
              <div className="text-xl font-bold text-navy leading-tight">
                {ctx.full_name}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-navy text-ivory flex items-center justify-center text-[10px] font-mono font-bold">
              F6.0
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-left mb-6">
            <div>
              <div className="text-[10px] font-semibold tracking-widest text-navy/50 uppercase mb-0.5">
                Chapter
              </div>
              <div className="text-sm font-semibold text-navy">
                {ctx.chapter_name ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold tracking-widest text-navy/50 uppercase mb-0.5">
                Edition
              </div>
              <div className="text-sm font-semibold text-navy">2026</div>
            </div>
          </div>

          {/* Serial badges */}
          <div className="grid grid-cols-2 gap-2 md:gap-3 mb-6">
            <div className="p-2 md:p-3 rounded-lg bg-yi-gold/10 border border-yi-gold/30 text-center">
              <div className="text-xl md:text-2xl font-extrabold text-yi-gold">
                #<CountUp to={ctx.serial_in_chapter} />
              </div>
              <div className="text-[8px] md:text-[9px] text-navy/60 tracking-wider uppercase mt-0.5 break-words leading-tight">
                in {ctx.chapter_name ?? "chapter"}
              </div>
            </div>
            <div className="p-2 md:p-3 rounded-lg bg-navy/5 border border-navy/10 text-center">
              <div className="text-xl md:text-2xl font-extrabold text-navy">
                #<CountUp to={ctx.serial_in_edition} />
              </div>
              <div className="text-[8px] md:text-[9px] text-navy/60 tracking-wider uppercase mt-0.5 leading-tight">
                in India
              </div>
            </div>
          </div>

          {/* Track or no-track */}
          {ctx.track_slug && ctx.track_name ? (
            <div
              className="p-3 rounded-lg text-center"
              style={{
                background: trackColor + "11",
                borderWidth: 1,
                borderColor: trackColor + "44",
              }}
            >
              <div className="text-[10px] font-semibold tracking-widest uppercase mb-0.5" style={{ color: trackColor }}>
                Your Track
              </div>
              <div className="text-base font-bold text-navy">
                {ctx.track_name}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-navy/5 border border-dashed border-navy/20 text-center">
              <div className="text-[10px] font-semibold tracking-widest uppercase text-navy/60 mb-0.5">
                Your Track
              </div>
              <div className="text-sm text-navy/60 italic">
                You&apos;ll join a team in the next step
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className={`mt-10 px-8 py-4 min-h-[44px] rounded-xl bg-navy text-ivory font-semibold hover:bg-navy-dark shadow-sm hover:shadow-lg transition-all text-base ${
          revealed ? "opacity-100" : "opacity-0"
        }`}
      >
        Finish my profile → <span className="text-yi-gold">+50 points</span>
      </button>
    </div>
  );
}
