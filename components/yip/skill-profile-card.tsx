"use client";

import { Card, CardContent } from "@/components/yip/ui/card";
import { Sparkles, BookOpen, Mic, Scale, Gavel } from "lucide-react";
import type { SkillProfile, SkillAxis } from "@/app/yip/actions/skill-profile";

// ─── Phase 19 / F — Skill Profile Card ────────────────────────────
//
// Renders 4 strength rows (research / speaking / policy / process) as
// QUALITATIVE BANDS — Strong / Confident / Growing / Emerging — never a
// number. Director ruling: participants must never see a raw score, average
// or percentage on /me (numbers invite "I beat you" comparison & disputes
// between students). The underlying 0–100 axis value (from
// actions/skill-profile.ts) is collapsed to a band + a band-quantised bar, so
// two students in the same band look identical and nothing precise is
// comparable. This card never shows rank either.

interface AxisMeta {
  key: SkillAxis;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  tint: string;
}

const AXES: AxisMeta[] = [
  {
    key: "research",
    label: "Research-oriented",
    hint: "Depth, relevance, originality of content",
    icon: BookOpen,
    gradient: "from-blue-500 to-cyan-400",
    tint: "text-blue-600",
  },
  {
    key: "speaking",
    label: "Speaking-oriented",
    hint: "Clarity, confidence, fluency on the floor",
    icon: Mic,
    gradient: "from-orange-500 to-amber-400",
    tint: "text-orange-600",
  },
  {
    key: "policy",
    label: "Policy-oriented",
    hint: "Argument strength, persuasion, policy analysis",
    icon: Scale,
    gradient: "from-emerald-500 to-teal-400",
    tint: "text-emerald-600",
  },
  {
    key: "process",
    label: "Process-oriented",
    hint: "Parliamentary conduct, rules, teamwork",
    icon: Gavel,
    gradient: "from-violet-500 to-purple-400",
    tint: "text-violet-600",
  },
];

// Collapse a 0–100 axis value into a qualitative, NON-NUMERIC band. Bands are
// self-referential (where a participant's OWN strength sits), and the bar fill
// is quantised to the band so it is never a precise, screenshot-comparable
// figure. Order matters: highest threshold first.
function axisBand(value: number): { label: string; fill: number } {
  if (value <= 0) return { label: "Not yet rated", fill: 6 };
  if (value >= 75) return { label: "Strong", fill: 92 };
  if (value >= 55) return { label: "Confident", fill: 72 };
  if (value >= 35) return { label: "Growing", fill: 50 };
  return { label: "Emerging", fill: 28 };
}

export function SkillProfileCard({ profile }: { profile: SkillProfile }) {
  const hasAny =
    profile.research > 0 ||
    profile.speaking > 0 ||
    profile.policy > 0 ||
    profile.process > 0;

  // No scores yet — be honest. The /me page renders during setup too.
  if (!hasAny || profile.sample_size === 0) {
    return (
      <Card className="border-indigo-200/50 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400" />
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-2 mb-2">
            <Sparkles className="size-5 text-indigo-600 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Your Skill Profile
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Profile builds after your first scoring round
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3 italic">
            Once jurors start scoring you on research, speaking, policy and
            parliamentary process, this card will show where your strengths
            sit.
          </p>
        </CardContent>
      </Card>
    );
  }

  // sample_size is the count of jury score rows aggregated. Under 3 means
  // the profile reflects only one or two opinions — label as early
  // indicator so students don't over-index on it.
  const isEarly = profile.sample_size < 3;

  return (
    <Card className="border-indigo-200/50 overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400" />
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-start gap-2">
            <Sparkles className="size-5 text-indigo-600 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Your Skill Profile
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {isEarly
                  ? "Early indicator — builds with each round"
                  : "Where your strengths sit, across your YIP rounds"}
              </p>
            </div>
          </div>
          {isEarly && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200 shrink-0">
              Early
            </span>
          )}
        </div>

        <div className="space-y-3">
          {AXES.map((axis) => {
            const value = profile[axis.key];
            const Icon = axis.icon;
            return (
              <div key={axis.key}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-1.5 text-gray-700">
                    <Icon className={`size-3.5 ${axis.tint}`} />
                    <span className="font-medium">{axis.label}</span>
                  </span>
                  <span className={`font-semibold ${axis.tint}`}>
                    {axisBand(value).label}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${axis.gradient} transition-[width] duration-500`}
                    style={{ width: `${axisBand(value).fill}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">{axis.hint}</p>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-gray-400 mt-4 italic leading-relaxed">
          A reflection of your own strengths across the jury&apos;s criteria —
          shown as bands, never a score, rank or comparison to other delegates.
        </p>
      </CardContent>
    </Card>
  );
}
