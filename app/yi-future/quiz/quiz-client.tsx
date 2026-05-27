"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProgramWordmark } from "@/components/yi-future/brand/BrandHeader";
import { TrackQuizStep } from "@/app/yi-future/join/steps/track-quiz";
import { QuizResultStep } from "@/app/yi-future/join/steps/quiz-result";
import type { QuizResult } from "@/lib/yi-future/quiz";

type TrackMini = {
  slug: string;
  name: string;
  color_hex: string | null;
  icon: string | null;
  description: string | null;
};

export function QuizClient({ tracks }: { tracks: TrackMini[] }) {
  const router = useRouter();
  const [step, setStep] = useState<"intro" | "quiz" | "result">("intro");
  const [result, setResult] = useState<QuizResult | null>(null);
  const [matchedTrack, setMatchedTrack] = useState<TrackMini | null>(null);

  return (
    <main className="min-h-screen bg-ivory flex flex-col">
      <header className="py-4 px-4 border-b border-navy/10 bg-white safe-top">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <ProgramWordmark href="/yi-future" />
          <Link
            href="/yi-future/access"
            className="text-xs text-navy/60 hover:text-navy font-medium"
          >
            Already have a code? Sign in
          </Link>
        </div>
      </header>

      <section className="flex-1">
        {step === "intro" && (
          <div className="max-w-lg mx-auto px-4 py-12 md:py-20 text-center">
            <div className="text-5xl mb-4">🧭</div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-navy tracking-tight">
              Which track fits you?
            </h1>
            <p className="mt-3 text-base text-navy/60 max-w-md mx-auto">
              Answer 3 quick questions and we&apos;ll match you to the Future 6.0
              track that fits your interests — Climate Action, Healthcare, Smart
              Cities, or Rural Development.
            </p>
            <button
              type="button"
              onClick={() => setStep("quiz")}
              className="mt-8 px-8 py-4 rounded-xl bg-[#F5A623] text-navy font-extrabold text-lg hover:bg-[#F5A623]/90 transition-all shadow-lg hover:shadow-xl"
            >
              Start the quiz
            </button>
            <p className="mt-4 text-xs text-navy/40">
              Takes about 30 seconds. No signup required.
            </p>
          </div>
        )}

        {step === "quiz" && (
          <TrackQuizStep
            tracks={tracks}
            onBack={() => setStep("intro")}
            onComplete={(r, t) => {
              setResult(r);
              setMatchedTrack(t);
              setStep("result");
            }}
            onHaveCode={() => router.push("/yi-future/access")}
          />
        )}

        {step === "result" && result && (
          <QuizResultStep
            result={result}
            track={matchedTrack}
            tracks={tracks}
            onRetake={() => {
              setResult(null);
              setMatchedTrack(null);
              setStep("quiz");
            }}
          />
        )}
      </section>

      <footer className="border-t border-navy/10 py-6 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center space-y-2">
          <p className="text-[11px] text-navy/40">
            Yi YUVA Future 6.0 · From Opinions to Impact
          </p>
          <div className="flex justify-center gap-4 text-xs">
            <Link
              href="/yi-future/join"
              className="text-navy/50 hover:text-navy font-medium"
            >
              Register
            </Link>
            <Link
              href="/yi-future/access"
              className="text-navy/50 hover:text-navy font-medium"
            >
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
