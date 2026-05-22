"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import { Badge } from "@/components/yip/ui/badge";
import { Input } from "@/components/yip/ui/input";
import {
  MessageSquare,
  SkipForward,
  Check,
  ChevronDown,
  ChevronUp,
  Play,
  Landmark,
} from "lucide-react";
import { cn } from "@/lib/yip/utils";
import { MINISTRIES, PARTY_COLORS } from "@/lib/yip/constants";
import {
  advanceQuestion,
  markAnswered,
  skipQuestion,
  getCurrentQuestion,
  getQueuedQuestions,
  getCompletedQuestions,
} from "@/app/actions/yip/questions";
import type {
  CurrentQuestionInfo,
  QuestionWithSubmitter,
} from "@/app/actions/yip/questions";
import { toast } from "sonner";

function getMinistryLabel(key: string): string {
  const found = MINISTRIES.find((m) => m.key === key);
  return found ? found.label : key;
}

interface QuestionHourPanelProps {
  eventId: string;
}

export function QuestionHourPanel({ eventId }: QuestionHourPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [currentQuestion, setCurrentQuestion] =
    useState<CurrentQuestionInfo | null>(null);
  const [queuedQuestions, setQueuedQuestions] = useState<
    QuestionWithSubmitter[]
  >([]);
  const [completedQuestions, setCompletedQuestions] = useState<
    QuestionWithSubmitter[]
  >([]);
  const [answerSummary, setAnswerSummary] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [current, queued, completed] = await Promise.all([
      getCurrentQuestion(eventId),
      getQueuedQuestions(eventId),
      getCompletedQuestions(eventId),
    ]);
    setCurrentQuestion(current);
    setQueuedQuestions(queued);
    setCompletedQuestions(completed);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function handleAdvance() {
    startTransition(async () => {
      const result = await advanceQuestion(eventId);
      if (result.success) {
        toast.success(
          result.data.nextQuestionId
            ? "Advanced to next question"
            : "No more questions in queue"
        );
        setAnswerSummary("");
        fetchAll();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleMarkAnswered() {
    if (!currentQuestion) return;
    startTransition(async () => {
      const result = await markAnswered(
        currentQuestion.id,
        answerSummary || undefined
      );
      if (result.success) {
        toast.success("Question marked as answered");
        setAnswerSummary("");
        fetchAll();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleSkip() {
    if (!currentQuestion) return;
    startTransition(async () => {
      const result = await skipQuestion(currentQuestion.id);
      if (result.success) {
        toast.success("Question skipped");
        setAnswerSummary("");
        fetchAll();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Loading Question Hour...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="size-5 text-cyan-600" />
        <h3 className="text-lg font-bold text-gray-900">Question Hour</h3>
        <Badge variant="secondary" className="bg-cyan-100 text-cyan-700">
          {queuedQuestions.length} queued
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* ─── Left: Current Question ────────────────────── */}
        <div className="space-y-4">
          {currentQuestion ? (
            <Card className="border-2 border-cyan-200 bg-cyan-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-cyan-700">
                  <MessageSquare className="size-4" />
                  Current Question
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Ministry badge */}
                <Badge
                  variant="secondary"
                  className="bg-gray-100 text-gray-700"
                >
                  <Landmark className="size-3 mr-1" />
                  Minister of{" "}
                  {getMinistryLabel(currentQuestion.directed_to_ministry)}
                </Badge>

                {/* Question text */}
                <p className="text-lg font-medium text-gray-900 leading-relaxed">
                  {currentQuestion.question_text}
                </p>

                {/* Submitter info */}
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-gray-700">
                    {currentQuestion.submitter?.full_name ?? "Unknown"}
                  </span>
                  {currentQuestion.submitter?.party_side && (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                        PARTY_COLORS[
                          currentQuestion.submitter
                            .party_side as keyof typeof PARTY_COLORS
                        ]?.badge ?? "bg-gray-500 text-white"
                      )}
                    >
                      {currentQuestion.submitter.party_side === "ruling"
                        ? "Ruling"
                        : "Opposition"}
                    </span>
                  )}
                  {currentQuestion.submitter?.constituency_name && (
                    <span className="text-gray-500">
                      {currentQuestion.submitter.constituency_name}
                    </span>
                  )}
                </div>

                {/* Star indicator */}
                {currentQuestion.question_type === "starred" && (
                  <Badge
                    variant="secondary"
                    className="bg-amber-100 text-amber-700"
                  >
                    Starred Question
                  </Badge>
                )}

                {/* Answer summary input */}
                <div>
                  <label className="text-xs font-medium text-gray-500">
                    Answer Summary (optional)
                  </label>
                  <Input
                    value={answerSummary}
                    onChange={(e) => setAnswerSummary(e.target.value)}
                    placeholder="Brief summary of minister's response..."
                    className="mt-1"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={handleMarkAnswered}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="size-3.5 mr-1" />
                    Mark Answered
                  </Button>
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={handleAdvance}
                  >
                    <SkipForward className="size-3.5 mr-1" />
                    Next Question
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={handleSkip}
                  >
                    Skip
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <MessageSquare className="mx-auto size-10 text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">
                  No question is currently being asked
                </p>
                {queuedQuestions.length > 0 && (
                  <Button
                    size="sm"
                    className="mt-3"
                    disabled={isPending}
                    onClick={handleAdvance}
                  >
                    <Play className="size-3.5 mr-1" />
                    Start First Question
                  </Button>
                )}
                {queuedQuestions.length === 0 && (
                  <p className="text-sm text-gray-400 mt-1">
                    Approve questions and set queue order in the Questions tab
                    first.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Completed Questions (collapsible) */}
          {completedQuestions.length > 0 && (
            <Card>
              <CardHeader className="pb-0">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex w-full items-center justify-between"
                >
                  <CardTitle className="text-sm text-muted-foreground">
                    Completed ({completedQuestions.length})
                  </CardTitle>
                  {showCompleted ? (
                    <ChevronUp className="size-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="size-4 text-gray-400" />
                  )}
                </button>
              </CardHeader>
              {showCompleted && (
                <CardContent className="pt-3">
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {completedQuestions.map((q) => (
                      <div
                        key={q.id}
                        className="rounded-md bg-gray-50 p-2.5 text-sm"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-700">
                            {q.submitter?.full_name}
                          </span>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[9px]",
                              q.status === "answered"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-gray-100 text-gray-500"
                            )}
                          >
                            {q.status === "answered" ? "Answered" : "Skipped"}
                          </Badge>
                        </div>
                        <p className="text-gray-600 line-clamp-2">
                          {q.question_text}
                        </p>
                        {q.answer_summary && (
                          <p className="text-xs text-emerald-600 mt-1">
                            {q.answer_summary}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}
        </div>

        {/* ─── Right: Queue Sidebar ──────────────────────── */}
        <div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Question Queue</CardTitle>
            </CardHeader>
            <CardContent>
              {queuedQuestions.length > 0 ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {queuedQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="flex items-start gap-2 rounded-md border p-2"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded bg-gray-100 text-[10px] font-bold text-gray-500">
                        {q.queue_order}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-700 truncate">
                          {q.submitter?.full_name}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {getMinistryLabel(q.directed_to_ministry)}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {q.question_text}
                        </p>
                      </div>
                      {q.question_type === "starred" && (
                        <span className="text-amber-400 text-xs">&#9733;</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No questions queued. Set queue order for approved questions in
                  the Questions tab.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
