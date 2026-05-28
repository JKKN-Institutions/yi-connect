"use client";

import { Card, CardContent } from "@/components/yip/ui/card";
import { Sparkles, BookOpen, Mic, Scale, Gavel } from "lucide-react";
import type { SkillProfile, SkillAxis } from "@/app/yip/actions/skill-profile";

// ─── Phase 19 / F — Skill Profile Card ────────────────────────────
//
// Renders 4 horizontal bars (research / speaking / policy / process).
// Chose bars over a radar chart so we avoid pulling a chart library
// for one card, the layout is mobile-friendly, and the visual matches
// the existing Score Breakdown bars on /me. Each bar shows the axis
// value 0–100 derived from sub-criterion averages across all of the
// participant's submitted scores (see actions/skill-profile.ts).

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
                  : `Based on ${profile.sample_size} jury scores across your YIP rounds`}
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
                  <span className="font-semibold text-gray-900 tabular-nums">
                    {value}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${axis.gradient} transition-[width] duration-500`}
                    style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">{axis.hint}</p>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-gray-400 mt-4 italic leading-relaxed">
          Derived from your jury sub-criterion scores. Scores are
          normalised against the handbook&apos;s max for each criterion.
        </p>
      </CardContent>
    </Card>
  );
}
