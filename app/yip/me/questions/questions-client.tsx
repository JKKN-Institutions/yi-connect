"use client";

import { useState, useEffect, useTransition } from "react";
import { ministryLabel, type MinistryPortfolio } from "@/lib/yip/cabinet";
import { submitQuestion, getMyQuestions } from "@/app/yip/actions/questions";
import { Button } from "@/components/yip/ui/button";
import { Textarea } from "@/components/yip/ui/textarea";
import { Badge } from "@/components/yip/ui/badge";
import { Label } from "@/components/yip/ui/label";
import {
  SectionShell,
  INK,
  SAFFRON,
  GREEN,
  GOLD,
  SERIF,
  inkA,
} from "../credential-ui";
import {
  MessageSquare,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/yip/database";

type Question = Tables<{ schema: "yip" }, "questions">;

// ─── Session (server-provided) ──────────────────────────────────
// The yip_session cookie is httpOnly, so it CANNOT be read from
// document.cookie — the server page parses it and passes it down.

export interface ParticipantSession {
  type: "participant";
  id: string;
  name: string;
  eventId: string;
}

// ─── Status helpers ─────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: typeof Clock }
> = {
  submitted: {
    label: "Submitted",
    className: "bg-blue-100 text-blue-700",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    className: "bg-green-100 text-green-700",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-700",
    icon: XCircle,
  },
  asked: {
    label: "Being Asked",
    className: "bg-amber-100 text-amber-700",
    icon: MessageSquare,
  },
  answered: {
    label: "Answered",
    className: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle2,
  },
  skipped: {
    label: "Skipped",
    className: "bg-gray-100 text-gray-500",
    icon: XCircle,
  },
};

const STATUS_ACCENT: Record<string, string> = {
  submitted: SAFFRON,
  approved: GREEN,
  rejected: "#9A3324",
  asked: GOLD,
  answered: GREEN,
  skipped: inkA(0.2),
};

// ─── Page Component ─────────────────────────────────────────────

export function QuestionsClient({
  initialSession,
  ministries,
}: {
  initialSession: ParticipantSession;
  /** The event's effective cabinet portfolios (per-event override or default). */
  ministries: MinistryPortfolio[];
}) {
  const session: ParticipantSession | null = initialSession;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [ministry, setMinistry] = useState<string>("");
  const [questionText, setQuestionText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);

  // Load data for the server-provided session on mount
  useEffect(() => {
    loadQuestions(initialSession.eventId, initialSession.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadQuestions(eventId: string, participantId: string) {
    const data = await getMyQuestions(eventId, participantId);
    setQuestions(data);
    setLoading(false);
  }

  function handleSubmit() {
    if (!session) return;
    if (!ministry) {
      toast.error("Please select a ministry");
      return;
    }
    if (questionText.trim().length < 20) {
      toast.error("Question must be at least 20 characters");
      return;
    }

    startTransition(async () => {
      const result = await submitQuestion(
        session.eventId,
        session.id,
        ministry,
        questionText
      );
      if (result.success) {
        toast.success("Question submitted successfully!");
        setQuestionText("");
        setMinistry("");
        loadQuestions(session.eventId, session.id);
      } else {
        toast.error(result.error);
      }
    });
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="size-10 text-amber-400 mb-3" />
        <p className="text-gray-600">Session not found. Please rejoin the event.</p>
      </div>
    );
  }

  const submittedCount = questions.length;
  const canSubmit = submittedCount < 3;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p
          className="text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ color: SAFFRON }}
        >
          The Floor
        </p>
        <h1
          className="mt-0.5 text-[28px] font-bold leading-[1.1] tracking-tight"
          style={{ ...SERIF, color: INK }}
        >
          Question Hour
        </h1>
        <p className="text-sm mt-1.5" style={{ color: inkA(0.6) }}>
          Submit your questions for the Cabinet Ministers during Question Hour
        </p>
      </div>

      {/* Submission count */}
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className={
            canSubmit
              ? "bg-blue-100 text-blue-700"
              : "bg-amber-100 text-amber-700"
          }
        >
          {submittedCount} of 3 questions submitted
        </Badge>
      </div>

      {/* Instruction */}
      <SectionShell accent={SAFFRON}>
        <div className="px-5 py-4">
          <p className="text-sm" style={{ color: inkA(0.75) }}>
            Your questions will be directed to the relevant Cabinet Minister
            during Question Hour. Each participant can submit up to 3 questions.
            Questions are reviewed by the organizers before being presented in
            the House.
          </p>
        </div>
      </SectionShell>

      {/* Submission Form */}
      {canSubmit ? (
        <SectionShell accent={SAFFRON}>
          <div className="px-5 py-4 space-y-4">
            <div>
              <Label htmlFor="ministry" className="text-sm font-medium">
                Directed to Ministry *
              </Label>
              <select
                id="ministry"
                value={ministry}
                onChange={(e) => setMinistry(e.target.value)}
                className="mt-1.5 flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              >
                <option value="">Select a ministry...</option>
                {ministries.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="question" className="text-sm font-medium">
                Your Question *
              </Label>
              <Textarea
                id="question"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Type your question here (minimum 20 characters)..."
                className="mt-1.5"
                rows={4}
              />
              <p className="mt-1 text-xs text-gray-400">
                {questionText.trim().length}/20 characters minimum
              </p>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={
                isPending ||
                !ministry ||
                questionText.trim().length < 20
              }
              className="w-full bg-[#FF9933] hover:bg-[#E68A2E]"
            >
              {isPending ? (
                "Submitting..."
              ) : (
                <>
                  <Send className="size-4 mr-1.5" />
                  Submit Question
                </>
              )}
            </Button>
          </div>
        </SectionShell>
      ) : (
        <SectionShell accent={GOLD}>
          <div className="px-5 py-6 text-center">
            <HelpCircle className="mx-auto size-8 text-amber-400 mb-2" />
            <p className="text-sm font-medium text-gray-700">
              Maximum questions reached
            </p>
            <p className="text-xs text-gray-500 mt-1">
              You have submitted all 3 allowed questions.
            </p>
          </div>
        </SectionShell>
      )}

      {/* Submitted Questions List */}
      {loading ? (
        <div className="text-center py-8 text-sm text-gray-400">
          Loading your questions...
        </div>
      ) : questions.length > 0 ? (
        <div className="space-y-3">
          <h2
            className="text-[18px] font-semibold"
            style={{ ...SERIF, color: INK }}
          >
            Your Submitted Questions
          </h2>
          {questions.map((q, idx) => {
            const status = q.status ?? "submitted";
            const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.submitted;
            const StatusIcon = config.icon;
            return (
              <SectionShell
                key={q.id}
                accent={STATUS_ACCENT[status] ?? SAFFRON}
              >
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-medium text-gray-400">
                          Q{idx + 1}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${config.className}`}
                        >
                          <StatusIcon className="size-3 mr-0.5" />
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-800 leading-relaxed">
                        {q.question_text}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        Directed to: Minister of{" "}
                        {ministryLabel(q.directed_to_ministry, ministries)}
                      </p>
                      {q.answer_summary && (
                        <div className="mt-2 rounded-md bg-emerald-50 p-2">
                          <p className="text-xs font-medium text-emerald-700">
                            Answer Summary:
                          </p>
                          <p className="text-xs text-emerald-600 mt-0.5">
                            {q.answer_summary}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </SectionShell>
            );
          })}
        </div>
      ) : (
        !loading && (
          <div className="text-center py-8 text-sm text-gray-400">
            No questions submitted yet. Use the form above to ask your first
            question.
          </div>
        )
      )}
    </div>
  );
}
