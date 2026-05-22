"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Send, MessageCircleHeart, PartyPopper, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { submitParticipantFeedback } from "@/app/actions/feedback";
import { PARTICIPANT_QUESTIONS, type FeedbackPayload } from "@/lib/yip/feedback";

type Props = {
  eventId: string;
  eventName: string;
  participantId: string;
  participantName: string;
};

type FormState = {
  overall_rating: number | null;
  organization_rating: number | null;
  content_rating: number | null;
  nps_score: number | null;
  biggest_takeaway: string;
  learned_something: string;
  suggestions: string;
};

const INITIAL: FormState = {
  overall_rating: null,
  organization_rating: null,
  content_rating: null,
  nps_score: null,
  biggest_takeaway: "",
  learned_something: "",
  suggestions: "",
};

export function FeedbackFormClient({
  eventId,
  eventName,
  participantId,
  participantName,
}: Props) {
  const [state, setState] = useState<FormState>(INITIAL);
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  // Resolve required fields from shared metadata
  const requiredKeys = PARTICIPANT_QUESTIONS.filter((q) => q.required).map(
    (q) => q.key
  );

  const canSubmit =
    state.overall_rating !== null &&
    state.organization_rating !== null &&
    state.content_rating !== null &&
    state.nps_score !== null &&
    state.biggest_takeaway.trim().length > 0 &&
    !isPending;

  function handleSubmit() {
    // Client-side guards for clearer error surfacing
    for (const key of requiredKeys) {
      const v = state[key as keyof FormState];
      if (v === null || v === "" || v === undefined) {
        toast.error("Please complete all required fields");
        return;
      }
    }

    const payload: FeedbackPayload = {
      overall_rating: state.overall_rating,
      organization_rating: state.organization_rating,
      content_rating: state.content_rating,
      nps_score: state.nps_score,
      biggest_takeaway: state.biggest_takeaway,
      learned_something: state.learned_something,
      suggestions: state.suggestions,
      would_recommend:
        state.nps_score !== null ? state.nps_score >= 7 : null,
    };

    startTransition(async () => {
      const res = await submitParticipantFeedback(
        eventId,
        participantId,
        payload
      );
      if (res.success) {
        setSubmitted(true);
      } else {
        toast.error(res.error);
      }
    });
  }

  if (submitted) {
    return <ThankYouScreen rating={state.overall_rating ?? 5} />;
  }

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-[#FF9933]/10 via-white to-[#138808]/10 p-5 shadow-sm ring-1 ring-[#FF9933]/20">
        <div className="flex items-center gap-2 mb-2">
          <MessageCircleHeart className="size-5 text-[#FF9933]" />
          <h1 className="text-base font-bold text-gray-900">
            Your feedback matters
          </h1>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          Hi {participantName.split(" ")[0]} — tell us how{" "}
          <span className="font-medium text-gray-800">{eventName}</span> went
          for you. It takes about 2 minutes.
        </p>
      </div>

      {/* ── Star ratings ───────────────────────────────── */}
      <Card>
        <CardContent className="pt-5 space-y-6">
          <StarRating
            label="Overall, how would you rate the YIP session?"
            helper="1 = poor, 5 = excellent"
            required
            value={state.overall_rating}
            onChange={(v) =>
              setState((s) => ({ ...s, overall_rating: v }))
            }
          />
          <StarRating
            label="How well was the event organized?"
            helper="Venue, timing, logistics, communication"
            required
            value={state.organization_rating}
            onChange={(v) =>
              setState((s) => ({ ...s, organization_rating: v }))
            }
          />
          <StarRating
            label="How would you rate the content and discussions?"
            helper="Agenda depth, debate quality, learning value"
            required
            value={state.content_rating}
            onChange={(v) =>
              setState((s) => ({ ...s, content_rating: v }))
            }
          />
        </CardContent>
      </Card>

      {/* ── NPS ────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5">
          <div className="mb-1">
            <Label className="text-sm font-semibold text-gray-900">
              How likely are you to recommend YIP to a friend?{" "}
              <span className="text-red-500">*</span>
            </Label>
            <p className="text-xs text-gray-500 mt-0.5">
              0 = not at all, 10 = extremely likely
            </p>
          </div>
          <NpsScale
            value={state.nps_score}
            onChange={(v) => setState((s) => ({ ...s, nps_score: v }))}
          />
        </CardContent>
      </Card>

      {/* ── Text: biggest takeaway (required) ─────────── */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <TextBlock
            id="takeaway"
            label="What's the single biggest thing you're taking away?"
            helper="One sentence — be specific"
            required
            value={state.biggest_takeaway}
            maxLength={500}
            onChange={(v) =>
              setState((s) => ({ ...s, biggest_takeaway: v }))
            }
          />

          <TextBlock
            id="learned"
            label="What did you learn about Parliament or civic life?"
            value={state.learned_something}
            maxLength={500}
            onChange={(v) =>
              setState((s) => ({ ...s, learned_something: v }))
            }
          />

          <TextBlock
            id="suggestions"
            label="What would make the next YIP better?"
            value={state.suggestions}
            maxLength={500}
            onChange={(v) => setState((s) => ({ ...s, suggestions: v }))}
          />
        </CardContent>
      </Card>

      {/* ── Submit ─────────────────────────────────────── */}
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full bg-gradient-to-r from-[#FF9933] to-[#E68A2E] hover:from-[#E68A2E] hover:to-[#CF791F] shadow-md h-11"
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 mr-1.5 animate-spin" />
            Submitting…
          </>
        ) : (
          <>
            <Send className="size-4 mr-1.5" />
            Submit feedback
          </>
        )}
      </Button>

      <p className="text-[11px] text-gray-400 text-center pb-2">
        You can only submit feedback once. Take a moment.
      </p>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function StarRating({
  label,
  helper,
  required,
  value,
  onChange,
}: {
  label: string;
  helper?: string;
  required?: boolean;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label className="text-sm font-semibold text-gray-900">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {helper && <p className="text-xs text-gray-500 mt-0.5">{helper}</p>}
      <div className="mt-3 flex items-center justify-between gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value !== null && n <= value;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className="flex-1 flex flex-col items-center gap-1 rounded-lg p-2 transition-all hover:bg-[#FF9933]/5 active:scale-95 min-h-[56px]"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
            >
              <Star
                className={
                  "size-8 transition-colors " +
                  (active
                    ? "fill-[#FF9933] text-[#FF9933]"
                    : "text-gray-200")
                }
              />
              <span
                className={
                  "text-[10px] font-medium " +
                  (active ? "text-[#FF9933]" : "text-gray-400")
                }
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NpsScale({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-3">
      <div className="grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }).map((_, n) => {
          const active = value === n;
          // Color-coded by NPS bucket
          const bucketColor =
            n <= 6
              ? active
                ? "bg-red-500 text-white border-red-500"
                : "bg-red-50 text-red-600 border-red-100 hover:bg-red-100"
              : n <= 8
                ? active
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100"
                : active
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100";

          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={
                "h-10 rounded-lg border text-sm font-bold transition-all active:scale-95 " +
                bucketColor
              }
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-gray-400">
        <span>Not at all</span>
        <span>Extremely likely</span>
      </div>
    </div>
  );
}

function TextBlock({
  id,
  label,
  helper,
  required,
  value,
  maxLength = 500,
  onChange,
}: {
  id: string;
  label: string;
  helper?: string;
  required?: boolean;
  value: string;
  maxLength?: number;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-sm font-semibold text-gray-900">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {helper && <p className="text-xs text-gray-500 mt-0.5">{helper}</p>}
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        className="mt-2"
        rows={3}
        placeholder="Type your answer…"
      />
      <p className="mt-1 text-[11px] text-gray-400 text-right">
        {value.length}/{maxLength}
      </p>
    </div>
  );
}

// ─── Thank you screen ────────────────────────────────────────────────

function ThankYouScreen({ rating }: { rating: number }) {
  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 via-[#FFF8F0] to-[#F0FFF4] p-8 text-center shadow-lg ring-1 ring-emerald-200/60">
        {/* Celebratory swirl */}
        <div className="absolute -top-4 -right-4 opacity-20">
          <PartyPopper className="size-28 text-emerald-500" />
        </div>
        <div className="relative">
          <div className="inline-flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-400 shadow-md mb-4">
            <PartyPopper className="size-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Thank you!
          </h1>
          <p className="text-sm text-gray-600 leading-relaxed max-w-sm mx-auto">
            Your feedback has been recorded. The Yi team reads every response
            and uses it to shape the next YIP.
          </p>

          <div className="mt-5 inline-flex items-center gap-0.5 rounded-full bg-white/80 px-4 py-2 shadow-sm">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={
                  "size-5 " +
                  (i < rating
                    ? "fill-[#FF9933] text-[#FF9933]"
                    : "text-gray-200")
                }
              />
            ))}
          </div>
        </div>
      </div>

      <Card className="border-[#FF9933]/20">
        <CardContent className="pt-5">
          <p className="text-sm text-gray-700 leading-relaxed">
            Keep an eye on your dashboard — results and certificates will be
            announced at the Valedictory Session.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
