"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import { Input } from "@/components/yip/ui/input";
import { Textarea } from "@/components/yip/ui/textarea";
import { Label } from "@/components/yip/ui/label";
import {
  Star,
  Send,
  PartyPopper,
  Loader2,
  Landmark,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { submitOrganizerFeedback } from "@/app/yip/actions/feedback";
import {
  type FeedbackPayload,
  type FeedbackRespondentType,
} from "@/lib/yip/feedback";

type Props = {
  eventId: string;
  eventName: string;
  chapterName: string | null;
};

type NonParticipantType = Exclude<FeedbackRespondentType, "participant">;

const ROLE_OPTIONS: { value: NonParticipantType; label: string; helper: string }[] = [
  {
    value: "organizer",
    label: "Organizer",
    helper: "Chapter / Yi team member running the event",
  },
  {
    value: "volunteer",
    label: "Volunteer",
    helper: "YUVA / student volunteer on the ground",
  },
  {
    value: "jury",
    label: "Jury Member",
    helper: "Evaluator / scorer for the session",
  },
];

type FormState = {
  name: string;
  email: string;
  overall_rating: number | null;
  organization_rating: number | null;
  content_rating: number | null;
  nps_score: number | null;
  what_worked: string;
  what_didnt_work: string;
  suggestions: string;
};

const INITIAL: FormState = {
  name: "",
  email: "",
  overall_rating: null,
  organization_rating: null,
  content_rating: null,
  nps_score: null,
  what_worked: "",
  what_didnt_work: "",
  suggestions: "",
};

export function OrganizerFeedbackFormClient({
  eventId,
  eventName,
  chapterName,
}: Props) {
  const [role, setRole] = useState<NonParticipantType | null>(null);
  const [state, setState] = useState<FormState>(INITIAL);
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  // Role picker screen
  if (!role) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-8">
        <div className="rounded-2xl bg-gradient-to-br from-[#FF9933]/10 via-white to-[#138808]/10 p-6 shadow-sm ring-1 ring-[#FF9933]/20 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Landmark className="size-5 text-[#FF9933]" />
            <h1 className="text-lg font-bold text-gray-900">
              Feedback for {eventName}
            </h1>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            {chapterName ? `${chapterName} · ` : ""}Young Indians Parliament.
            Your feedback helps improve future sessions.
          </p>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold text-gray-900">
            I&apos;m filling this as a…
          </Label>
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRole(opt.value)}
              className="w-full text-left rounded-xl border border-gray-200 bg-white p-4 hover:border-[#FF9933] hover:shadow-sm transition-all flex items-center justify-between group"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {opt.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.helper}</p>
              </div>
              <ChevronRight className="size-4 text-gray-300 group-hover:text-[#FF9933]" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Required field gates depend on role
  const needsOrg = role !== "jury";
  const needsContent = role !== "volunteer";

  const canSubmit =
    state.name.trim().length >= 2 &&
    state.email.includes("@") &&
    state.overall_rating !== null &&
    (!needsOrg || state.organization_rating !== null) &&
    (!needsContent || state.content_rating !== null) &&
    state.nps_score !== null &&
    state.what_didnt_work.trim().length > 0 &&
    !isPending;

  function handleSubmit() {
    if (!role) return;
    const payload: FeedbackPayload = {
      overall_rating: state.overall_rating,
      organization_rating: needsOrg ? state.organization_rating : null,
      content_rating: needsContent ? state.content_rating : null,
      nps_score: state.nps_score,
      what_worked: state.what_worked,
      what_didnt_work: state.what_didnt_work,
      suggestions: state.suggestions,
      would_recommend:
        state.nps_score !== null ? state.nps_score >= 7 : null,
    };

    startTransition(async () => {
      const res = await submitOrganizerFeedback(
        eventId,
        state.name,
        state.email,
        payload,
        role
      );
      if (res.success) {
        setSubmitted(true);
      } else {
        toast.error(res.error);
      }
    });
  }

  if (submitted) {
    return <ThankYou />;
  }

  const roleLabel = ROLE_OPTIONS.find((o) => o.value === role)!.label;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 space-y-5">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-[#FF9933]/10 via-white to-[#138808]/10 p-5 ring-1 ring-[#FF9933]/20 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-base font-bold text-gray-900">
            {eventName}
          </h1>
          <button
            type="button"
            onClick={() => setRole(null)}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            change role
          </button>
        </div>
        <p className="text-xs text-gray-600">
          Submitting as <span className="font-medium">{roleLabel}</span>
        </p>
      </div>

      {/* Identity */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div>
            <Label htmlFor="name" className="text-sm font-semibold">
              Your name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={state.name}
              onChange={(e) =>
                setState((s) => ({ ...s, name: e.target.value }))
              }
              placeholder="Full name"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="email" className="text-sm font-semibold">
              Your email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={state.email}
              onChange={(e) =>
                setState((s) => ({ ...s, email: e.target.value }))
              }
              placeholder="you@example.com"
              className="mt-1.5"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Used only for deduplication — we won&apos;t spam you.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Ratings */}
      <Card>
        <CardContent className="pt-5 space-y-6">
          <StarRating
            label="Overall, how did this event go?"
            required
            value={state.overall_rating}
            onChange={(v) => setState((s) => ({ ...s, overall_rating: v }))}
          />
          {needsOrg && (
            <StarRating
              label="Organization / logistics quality"
              helper="Venue, timing, coordination"
              required
              value={state.organization_rating}
              onChange={(v) =>
                setState((s) => ({ ...s, organization_rating: v }))
              }
            />
          )}
          {needsContent && (
            <StarRating
              label="Quality of content & discussion"
              required
              value={state.content_rating}
              onChange={(v) =>
                setState((s) => ({ ...s, content_rating: v }))
              }
            />
          )}
        </CardContent>
      </Card>

      {/* NPS */}
      <Card>
        <CardContent className="pt-5">
          <Label className="text-sm font-semibold">
            Would you recommend being part of YIP to your peers?{" "}
            <span className="text-red-500">*</span>
          </Label>
          <p className="text-xs text-gray-500 mt-0.5">0 = no, 10 = definitely</p>
          <NpsScale
            value={state.nps_score}
            onChange={(v) => setState((s) => ({ ...s, nps_score: v }))}
          />
        </CardContent>
      </Card>

      {/* Text */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <TextBlock
            id="worked"
            label="What worked well and should be repeated?"
            helper="Concrete practices — not generalities"
            value={state.what_worked}
            onChange={(v) =>
              setState((s) => ({ ...s, what_worked: v }))
            }
          />
          <TextBlock
            id="didnt"
            label="What broke or nearly broke?"
            required
            helper="Tell the truth — this is how the next chapter avoids it"
            value={state.what_didnt_work}
            onChange={(v) =>
              setState((s) => ({ ...s, what_didnt_work: v }))
            }
          />
          <TextBlock
            id="suggest"
            label="One change you'd make for the next event"
            value={state.suggestions}
            onChange={(v) =>
              setState((s) => ({ ...s, suggestions: v }))
            }
          />
        </CardContent>
      </Card>

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
      <p className="text-[11px] text-gray-400 text-center pb-8">
        One submission per email per role. Choose your words.
      </p>
    </div>
  );
}

// ─── Sub-components (mirror participant form) ────────────────────────

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
        <span>Definitely</span>
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
  onChange,
}: {
  id: string;
  label: string;
  helper?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  const MAX = 600;
  return (
    <div>
      <Label htmlFor={id} className="text-sm font-semibold text-gray-900">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {helper && <p className="text-xs text-gray-500 mt-0.5">{helper}</p>}
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX))}
        className="mt-2"
        rows={3}
        placeholder="Be concrete…"
      />
      <p className="mt-1 text-[11px] text-gray-400 text-right">
        {value.length}/{MAX}
      </p>
    </div>
  );
}

function ThankYou() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-14">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 via-[#FFF8F0] to-[#F0FFF4] p-8 text-center shadow-lg ring-1 ring-emerald-200/60">
        <div className="absolute -top-4 -right-4 opacity-20">
          <PartyPopper className="size-28 text-emerald-500" />
        </div>
        <div className="relative">
          <div className="inline-flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-400 shadow-md mb-4">
            <PartyPopper className="size-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Thank you — received.
          </h1>
          <p className="text-sm text-gray-600 leading-relaxed max-w-sm mx-auto">
            Your feedback has been saved. The organizing team and national Yi
            team will see your input.
          </p>
        </div>
      </div>
    </div>
  );
}
