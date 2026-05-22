/**
 * Track-interest quiz — 3 questions, each answer weighted to one of 4 tracks.
 * Used on /join for delegates who don't yet have a code: surface which
 * track resonates most, then hand them off to "Talk to your chapter admin".
 *
 * No external deps — pure data + a scorer.
 */

import type { TrackSlug } from "./constants";

export type QuizChoice = {
  label: string;
  weights: Partial<Record<TrackSlug, number>>;
  icon?: string;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  choices: QuizChoice[];
};

export const TRACK_QUIZ: QuizQuestion[] = [
  {
    id: "q1",
    prompt: "Which headline grabs you first thing in the morning?",
    choices: [
      {
        label: "City hits hazardous AQI for the 4th day in a row",
        icon: "🌍",
        weights: { climate_change: 3, public_health: 1 },
      },
      {
        label: "3 killed on the expressway · CCTV footage shows…",
        icon: "🚦",
        weights: { road_safety: 3 },
      },
      {
        label: "Assistive-tech startup wins UN design award",
        icon: "♿",
        weights: { accessibility: 3 },
      },
      {
        label: "Govt launches ₹2,000 cr scheme for rural clinics",
        icon: "🩺",
        weights: { public_health: 3 },
      },
    ],
  },
  {
    id: "q2",
    prompt: "If you had ₹100 crore to invest this weekend, you'd put it into…",
    choices: [
      {
        label: "Green transport + renewables in 10 Tier-2 cities",
        icon: "⚡",
        weights: { climate_change: 3, road_safety: 1 },
      },
      {
        label: "A nationwide smart-helmet + pedestrian-safety rollout",
        icon: "🛡️",
        weights: { road_safety: 3 },
      },
      {
        label: "Retrofitting 1,000 public buildings for universal access",
        icon: "🔧",
        weights: { accessibility: 3 },
      },
      {
        label: "Tele-medicine in every primary health centre",
        icon: "📡",
        weights: { public_health: 3 },
      },
    ],
  },
  {
    id: "q3",
    prompt: "The strongest policy wins aren't written — they're…",
    choices: [
      {
        label: "Measured in rivers that stay clean 5 years later",
        icon: "🌊",
        weights: { climate_change: 3 },
      },
      {
        label: "Counted in lives not lost on the road next year",
        icon: "💛",
        weights: { road_safety: 3 },
      },
      {
        label: "Felt by someone who finally rides the bus independently",
        icon: "🦽",
        weights: { accessibility: 3 },
      },
      {
        label: "Seen when a village gets its first working hospital",
        icon: "🏥",
        weights: { public_health: 3 },
      },
    ],
  },
];

export type QuizResult = {
  winner: TrackSlug;
  scores: Record<TrackSlug, number>;
  ordered: Array<{ slug: TrackSlug; score: number }>;
};

export function scoreQuiz(answers: Record<string, number>): QuizResult {
  const scores: Record<TrackSlug, number> = {
    climate_change: 0,
    road_safety: 0,
    accessibility: 0,
    public_health: 0,
  };
  for (const q of TRACK_QUIZ) {
    const idx = answers[q.id];
    if (idx === undefined) continue;
    const choice = q.choices[idx];
    if (!choice) continue;
    for (const [slug, w] of Object.entries(choice.weights)) {
      scores[slug as TrackSlug] += w ?? 0;
    }
  }
  const ordered = (Object.entries(scores) as Array<[TrackSlug, number]>)
    .map(([slug, score]) => ({ slug, score }))
    .sort((a, b) => b.score - a.score);
  return { winner: ordered[0]?.slug ?? "climate_change", scores, ordered };
}
