import { useEffect, useState } from "react";
import type { LiveCounts } from "@/app/yi-future/actions/gamification";
import { CountUp } from "@/components/ui/count-up";
import { getHeroVariant, HERO_HEADLINES } from "@/lib/yi-future/ab-test";
import type { HeroVariant } from "@/lib/yi-future/ab-test";

type TrackMini = {
  slug: string;
  name: string;
  color_hex: string | null;
  icon: string | null;
};

export function HeroStep({
  counts,
  tracks,
  onRegister,
  onHaveCode,
  onQuiz,
}: {
  counts: LiveCounts;
  tracks: TrackMini[];
  onRegister: () => void;
  onHaveCode: () => void;
  onQuiz: () => void;
}) {
  const [variant, setVariant] = useState<HeroVariant>("a");

  useEffect(() => {
    const v = getHeroVariant();
    setVariant(v);
    console.info("[hero-ab]", v);
  }, []);

  const headline = HERO_HEADLINES[variant];
  const accentClass =
    headline.accent === "gold" ? "text-yi-gold" : "text-yi-saffron";

  return (
    <div className="max-w-3xl mx-auto text-center px-4 py-10 md:py-16">
      <div
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yi-saffron/10 text-yi-saffron text-[11px] font-semibold tracking-wider uppercase mb-6 animate-[pulse_2.5s_ease-in-out_infinite]"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-yi-saffron" />
        Registrations open · 2026 Edition
      </div>

      <h1 className="text-5xl md:text-7xl font-extrabold text-navy tracking-tight leading-[0.95]">
        {headline.line1}
        <br />
        <span className={accentClass}>{headline.line2}</span>
      </h1>

      <p className="mt-6 text-base md:text-lg text-navy/70 max-w-2xl mx-auto leading-relaxed">
        Future 6.0 is a 90-day mentored journey where college students stop
        writing opinions and start shipping policy. One of four tracks is waiting
        for you.
      </p>

      {/* Live social-proof strip */}
      <div className="mt-10 grid grid-cols-3 gap-3 md:gap-6 max-w-xl mx-auto">
        <StatTile
          value={counts.delegatesTotal}
          label="delegates"
          accent="text-yi-gold"
        />
        <StatTile
          value={counts.chaptersActive}
          label="chapters live"
          accent="text-yi-saffron"
        />
        <StatTile
          value={counts.teamsCount}
          label="teams formed"
          accent="text-yi-green"
        />
      </div>

      {/* Tracks teaser */}
      <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 max-w-3xl mx-auto">
        {tracks.slice(0, 4).map((t) => (
          <div
            key={t.slug}
            className="group rounded-xl border border-navy/10 bg-white p-3 md:p-4 text-center hover:-translate-y-0.5 hover:shadow-md transition-all"
            style={{ borderColor: (t.color_hex ?? "#1a1a3e") + "33" }}
          >
            <div className="text-2xl md:text-3xl">{t.icon ?? "✦"}</div>
            <div
              className="mt-1 text-[11px] md:text-xs font-semibold tracking-wide uppercase"
              style={{ color: t.color_hex ?? "#1a1a3e" }}
            >
              {t.name}
            </div>
          </div>
        ))}
      </div>

      {/* CTA pair */}
      <div className="mt-12 flex flex-col md:flex-row gap-3 justify-center items-stretch max-w-lg mx-auto">
        <button
          type="button"
          onClick={onRegister}
          className="flex-1 py-4 px-6 rounded-xl bg-navy text-ivory font-semibold hover:bg-navy-dark shadow-sm hover:shadow-lg transition-all text-base group"
        >
          <span className="block text-[10px] tracking-widest uppercase text-ivory/60 mb-0.5">
            I&apos;m in →
          </span>
          <span>Register as a delegate</span>
        </button>
        <button
          type="button"
          onClick={onQuiz}
          className="flex-1 py-4 px-6 rounded-xl bg-white border-2 border-yi-gold text-navy font-semibold hover:bg-yi-gold/10 transition-all text-base"
        >
          <span className="block text-[10px] tracking-widest uppercase text-yi-gold mb-0.5">
            Not sure?
          </span>
          <span>Find my track · 45 sec quiz</span>
        </button>
      </div>

      <p className="mt-5 text-[11px] text-navy/50">
        Mentor, jury or partner?{" "}
        <button
          type="button"
          onClick={onHaveCode}
          className="font-semibold text-navy hover:text-yi-gold underline decoration-dotted"
        >
          Enter your access code →
        </button>
      </p>

      {counts.delegatesThisWeek > 0 && (
        <p className="mt-4 text-xs text-navy/50">
          <span className="font-semibold text-yi-saffron">
            {counts.delegatesThisWeek}
          </span>{" "}
          {counts.delegatesThisWeek === 1 ? "delegate" : "delegates"} joined this
          week.
        </p>
      )}
    </div>
  );
}

function StatTile({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl bg-white border border-navy/10 py-3 md:py-4">
      <div className={`text-3xl md:text-4xl font-extrabold ${accent}`}>
        <CountUp to={value} />
      </div>
      <div className="text-[10px] md:text-xs text-navy/60 uppercase tracking-wider mt-0.5">
        {label}
      </div>
    </div>
  );
}
