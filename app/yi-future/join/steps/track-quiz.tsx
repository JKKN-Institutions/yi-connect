import { useState } from "react";
import { TRACK_QUIZ, scoreQuiz, type QuizResult } from "@/lib/yi-future/quiz";

type TrackMini = {
  slug: string;
  name: string;
  color_hex: string | null;
  icon: string | null;
  description: string | null;
};

export function TrackQuizStep({
  tracks,
  onBack,
  onComplete,
  onHaveCode,
}: {
  tracks: TrackMini[];
  onBack: () => void;
  onComplete: (result: QuizResult, track: TrackMini | null) => void;
  onHaveCode: () => void;
}) {
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const question = TRACK_QUIZ[qIdx];
  const progress = ((qIdx + 1) / TRACK_QUIZ.length) * 100;

  function pick(choiceIdx: number) {
    const nextAnswers = { ...answers, [question.id]: choiceIdx };
    setAnswers(nextAnswers);

    if (qIdx < TRACK_QUIZ.length - 1) {
      setQIdx(qIdx + 1);
    } else {
      // done — score and hand up
      const result = scoreQuiz(nextAnswers);
      const track = tracks.find((t) => t.slug === result.winner) ?? null;
      onComplete(result, track);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10 md:py-12">
      <button
        type="button"
        onClick={qIdx === 0 ? onBack : () => setQIdx(qIdx - 1)}
        className="text-sm text-navy/60 hover:text-navy mb-6 min-h-[44px] py-2 px-3 inline-flex items-center"
      >
        ← Back
      </button>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex-1 h-1.5 bg-navy/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yi-gold to-yi-saffron transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-mono text-navy/50">
          {qIdx + 1}/{TRACK_QUIZ.length}
        </span>
      </div>

      <div className="text-[11px] font-semibold tracking-widest text-yi-gold uppercase mb-3">
        Track Match · Question {qIdx + 1}
      </div>
      <h2 className="text-2xl md:text-3xl font-bold text-navy leading-tight">
        {question.prompt}
      </h2>

      <div className="mt-8 space-y-3">
        {question.choices.map((c, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => pick(idx)}
            className="group w-full text-left p-4 md:p-5 min-h-[44px] rounded-xl border-2 border-navy/10 bg-white hover:border-yi-gold hover:bg-yi-gold/5 hover:-translate-y-0.5 hover:shadow-sm transition-all"
          >
            <div className="flex items-start gap-2 md:gap-3">
              <div className="text-xl md:text-3xl shrink-0 group-hover:scale-110 transition-transform leading-snug">
                {c.icon ?? "◆"}
              </div>
              <div className="flex-1 text-sm md:text-base font-medium text-navy leading-snug">
                {c.label}
              </div>
              <div className="text-navy/20 group-hover:text-yi-gold shrink-0 mt-1 transition-colors">
                →
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-10 pt-6 border-t border-navy/10 text-center">
        <p className="text-xs text-navy/50">
          Already have a code?{" "}
          <button
            type="button"
            onClick={onHaveCode}
            className="font-semibold text-navy hover:text-yi-gold"
          >
            Skip the quiz →
          </button>
        </p>
      </div>
    </div>
  );
}
