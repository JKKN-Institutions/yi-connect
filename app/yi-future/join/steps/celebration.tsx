import { useEffect, useState } from "react";
import Link from "next/link";
import { fireConfetti } from "@/components/ui/confetti";
import { CountUp } from "@/components/ui/count-up";
import type { DelegateContext } from "@/app/yi-future/actions/gamification";

const BADGE_META: Record<string, { icon: string; label: string; color: string }> = {
  joined: { icon: "🚀", label: "Joined Future 6.0", color: "#F5A623" },
  profile_complete: {
    icon: "⭐",
    label: "Profile Complete",
    color: "#FF9933",
  },
  voice_heard: { icon: "💛", label: "Voice Heard", color: "#138808" },
};

export function CelebrationStep({
  ctx,
  points,
  pct,
  badges,
}: {
  ctx: DelegateContext;
  points: number;
  pct: number;
  badges: string[];
}) {
  const [phase, setPhase] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    fireConfetti({ intensity: "big" });
    const t1 = setTimeout(() => setPhase(1), 900);
    const t2 = setTimeout(() => setPhase(2), 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const shareText = encodeURIComponent(
    `I just joined Future 6.0 — Yi YUVA's 90-day mentored journey to turn policy ideas into real impact. I'm delegate #${ctx.serial_in_edition} from ${ctx.chapter_name ?? "India"}.\n\nAre you in?`
  );
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join`
      : "https://yifuture-platform.vercel.app/join";

  const whatsappHref = `https://wa.me/?text=${shareText}%20${encodeURIComponent(shareUrl)}`;
  const twitterHref = `https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(shareUrl)}`;
  const cardPngUrl = `/api/join/card/${ctx.id}/og`;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 md:py-12 text-center">
      <div
        className={`transition-all duration-700 ${
          phase >= 0 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        <div className="text-5xl md:text-6xl mb-4">🎉</div>
        <div className="text-[11px] font-semibold tracking-widest text-yi-gold uppercase mb-3">
          You&apos;re in
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-navy tracking-tight leading-tight">
          The next 90 days just started.
        </h1>
        <p className="mt-3 text-base text-navy/70 max-w-lg mx-auto">
          Your chapter will reach out soon to group you into a team. Until then —
          here&apos;s what you&apos;ve unlocked.
        </p>
      </div>

      {/* Points + profile stats */}
      <div
        className={`mt-10 grid grid-cols-3 gap-3 max-w-lg mx-auto transition-all duration-700 delay-200 ${
          phase >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        <StatBlock
          value={points}
          label="points"
          color="text-yi-gold"
        />
        <StatBlock
          value={pct}
          suffix="%"
          label="profile"
          color="text-yi-saffron"
        />
        <StatBlock
          value={badges.length}
          label="badges"
          color="text-yi-green"
        />
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div
          className={`mt-8 flex flex-wrap justify-center gap-2 transition-all duration-700 delay-300 ${
            phase >= 1 ? "opacity-100" : "opacity-0"
          }`}
        >
          {badges.map((b) => {
            const meta = BADGE_META[b] ?? { icon: "◆", label: b, color: "#1a1a3e" };
            return (
              <div
                key={b}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border-2 text-sm font-semibold shadow-sm"
                style={{ borderColor: meta.color + "55", color: meta.color }}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Timeline */}
      <div
        className={`mt-10 p-6 rounded-2xl bg-gradient-to-br from-navy to-navy-dark text-ivory text-left transition-all duration-700 delay-500 ${
          phase >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        <div className="text-[11px] font-semibold tracking-widest text-yi-gold uppercase mb-4">
          Your 90-day journey
        </div>
        <div className="space-y-3">
          <JourneyStep
            emoji="🌱"
            phase="Phase A · Month 1"
            label="Understand the problem"
            status="upcoming"
          />
          <JourneyStep
            emoji="🔨"
            phase="Phase B · Month 2"
            label="Build your solution"
            status="upcoming"
          />
          <JourneyStep
            emoji="🏆"
            phase="Phase C · Month 3"
            label="Present · compete · win"
            status="upcoming"
          />
        </div>
      </div>

      {/* Share row */}
      <div
        className={`mt-10 transition-all duration-700 delay-700 ${
          phase >= 2 ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="text-sm text-navy/70 mb-3">
          Tell your friends. Bring them in.
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#25D366] text-white font-semibold hover:brightness-110 transition-all text-sm"
          >
            <span>💬</span> Share on WhatsApp
          </a>
          <a
            href={twitterHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-navy text-ivory font-semibold hover:bg-navy-dark transition-all text-sm"
          >
            <span>𝕏</span> Post on X
          </a>
          <a
            href={cardPngUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-white border-2 border-navy text-navy font-semibold hover:bg-navy hover:text-ivory transition-all text-sm"
          >
            <span>📸</span> Download my card
          </a>
        </div>
      </div>

      {/* Final CTA */}
      <div className="mt-10">
        <Link
          href="/yi-future/me"
          className="inline-block px-8 py-4 min-h-[44px] rounded-xl bg-yi-gold text-navy font-extrabold hover:bg-yi-gold-light transition-all text-base shadow-lg hover:shadow-xl"
        >
          Go to my dashboard →
        </Link>
      </div>
    </div>
  );
}

function StatBlock({
  value,
  label,
  color,
  suffix = "",
}: {
  value: number;
  label: string;
  color: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl bg-white border border-navy/10 p-4">
      <div className={`text-3xl md:text-4xl font-extrabold ${color}`}>
        <CountUp to={value} suffix={suffix} />
      </div>
      <div className="text-[10px] md:text-xs text-navy/60 uppercase tracking-wider mt-0.5">
        {label}
      </div>
    </div>
  );
}

function JourneyStep({
  emoji,
  phase,
  label,
}: {
  emoji: string;
  phase: string;
  label: string;
  status: string;
}) {
  return (
    <div className="flex items-center gap-2 md:gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
      <div className="text-xl md:text-2xl shrink-0 leading-none">{emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold tracking-widest text-yi-gold uppercase truncate">
          {phase}
        </div>
        <div className="text-sm font-semibold leading-tight">{label}</div>
      </div>
      <div className="text-[10px] text-ivory/40 shrink-0">Upcoming</div>
    </div>
  );
}
