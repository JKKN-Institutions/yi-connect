import { useState, useTransition } from "react";
import { completeProfile } from "@/app/yi-future/actions/gamification";
import type { DelegateContext } from "@/app/yi-future/actions/gamification";

type TrackMini = {
  slug: string;
  name: string;
  color_hex: string | null;
  icon: string | null;
};

const INDIA_STATES = [
  "Andhra Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu & Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

export function ProfileFormStep({
  ctx,
  tracks,
  onComplete,
  onSkip,
}: {
  ctx: DelegateContext;
  tracks: TrackMini[];
  onComplete: (pct: number, points: number, badges: string[]) => void;
  onSkip: () => void;
}) {
  const [fullName, setFullName] = useState(ctx.full_name ?? "");
  const [course, setCourse] = useState("");
  const [year, setYear] = useState<string>("");
  const [state, setState] = useState("");
  const [preferredTrack, setPreferredTrack] = useState<string>(
    ctx.preferred_track_slug ?? ctx.track_slug ?? ""
  );
  const [why, setWhy] = useState(ctx.why_statement ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Live progress %
  const filled = [fullName, course, year, state, preferredTrack].filter(Boolean).length;
  const whyBonus = why.trim().length >= 20 ? 2 : 0;
  const pct = Math.round(((filled + whyBonus) / 7) * 100);

  const whyChars = why.length;
  const whyValid = whyChars >= 20 && whyChars <= 300;
  const whyWords = why.trim() ? why.trim().split(/\s+/).length : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await completeProfile({
        full_name: fullName.trim() || undefined,
        course: course.trim() || undefined,
        year_of_study: year ? Number(year) : undefined,
        home_state: state.trim() || undefined,
        preferred_track_slug: preferredTrack || undefined,
        why_statement: why.trim() || undefined,
      });
      if (res.ok) {
        onComplete(res.profile_completion_pct, res.points, res.badges);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10 md:py-12">
      {/* Progress chip */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-[11px] font-semibold tracking-widest text-yi-gold uppercase">
          Profile · Step 2 of 3
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-navy/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-yi-gold to-yi-saffron transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-mono text-navy/60 w-10 text-right">
            {pct}%
          </span>
        </div>
      </div>

      <h1 className="text-3xl md:text-4xl font-bold text-navy tracking-tight">
        Tell us a little about you.
      </h1>
      <p className="mt-2 text-sm text-navy/60">
        A richer profile helps your chapter build the right team around you.
        Each field earns points.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Field label="Your name" pts={5} filled={!!fullName}>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="As you'd like it on your certificate"
            className="w-full px-4 py-3 rounded-lg border-2 border-navy/15 focus:border-yi-gold focus:outline-none text-navy"
          />
        </Field>

        <Field label="What do you study?" pts={5} filled={!!course}>
          <input
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            placeholder="e.g. BA Economics · B.Tech CS · MBA"
            className="w-full px-4 py-3 rounded-lg border-2 border-navy/15 focus:border-yi-gold focus:outline-none text-navy"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Year of study" pts={5} filled={!!year}>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border-2 border-navy/15 focus:border-yi-gold focus:outline-none text-navy bg-white"
            >
              <option value="">Select…</option>
              <option value="1">1st</option>
              <option value="2">2nd</option>
              <option value="3">3rd</option>
              <option value="4">4th</option>
              <option value="5">5th+</option>
            </select>
          </Field>

          <Field label="Home state" pts={5} filled={!!state}>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border-2 border-navy/15 focus:border-yi-gold focus:outline-none text-navy bg-white"
            >
              <option value="">Select…</option>
              {INDIA_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Track picker — visual cards */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-navy">
              Which track calls to you?
            </label>
            <span className="text-[10px] font-mono text-yi-gold">+5 pts</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tracks.map((t) => {
              const selected = preferredTrack === t.slug;
              return (
                <button
                  type="button"
                  key={t.slug}
                  onClick={() => setPreferredTrack(t.slug)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    selected
                      ? "border-yi-gold bg-yi-gold/10 shadow-sm"
                      : "border-navy/10 bg-white hover:border-navy/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{t.icon ?? "✦"}</span>
                    <span className="text-xs font-semibold text-navy">
                      {t.name}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Why — the hero field */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-navy">
              Your 30-word &quot;why&quot;
            </label>
            <span className="text-[10px] font-mono text-yi-saffron">+20 pts</span>
          </div>
          <textarea
            value={why}
            onChange={(e) => setWhy(e.target.value.slice(0, 300))}
            placeholder="Why does this program matter to you? What change are you here to build?"
            rows={4}
            className="w-full px-4 py-3 rounded-lg border-2 border-navy/15 focus:border-yi-gold focus:outline-none text-navy resize-none"
          />
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className={whyValid ? "text-yi-green" : "text-navy/50"}>
              {whyValid
                ? "✓ Looks great — your chapter will see this"
                : `Min 20 chars · currently ${whyChars}`}
            </span>
            <span className="font-mono text-navy/40">{whyWords} words</span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 min-[400px]:flex-row min-[400px]:gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="min-h-[44px] px-5 py-3 rounded-xl bg-white border border-navy/20 text-navy/70 font-medium hover:bg-navy/5 transition-all text-sm md:text-base"
          >
            Skip for now
          </button>
          <button
            type="submit"
            disabled={pending || !fullName.trim()}
            className="min-h-[44px] flex-1 py-3 rounded-xl bg-navy text-ivory font-semibold hover:bg-navy-dark transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm md:text-base"
          >
            {pending ? "Saving…" : `Save & continue → +${calcPoints(filled, !!why.trim() && whyValid, pct)} points`}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  pts,
  filled,
  children,
}: {
  label: string;
  pts: number;
  filled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold text-navy flex items-center gap-2">
          {label}
          {filled && <span className="text-yi-green text-xs">✓</span>}
        </label>
        <span className="text-[10px] font-mono text-yi-gold">+{pts} pts</span>
      </div>
      {children}
    </div>
  );
}

function calcPoints(filled: number, hasWhy: boolean, pct: number) {
  let p = 10 + filled * 5;
  if (hasWhy) p += 20;
  if (pct >= 100) p += 25;
  return p;
}
