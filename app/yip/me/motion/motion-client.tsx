"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import { Textarea } from "@/components/yip/ui/textarea";
import { Input } from "@/components/yip/ui/input";
import { Badge } from "@/components/yip/ui/badge";
import { Label } from "@/components/yip/ui/label";
import {
  Megaphone,
  Send,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { MINISTRIES } from "@/lib/yip/constants";
import {
  MOTION_TYPES,
  MOTION_STATUS_LABELS,
  MOTION_STATUS_COLORS,
  motionMeta,
  type MotionType,
} from "@/lib/yip/motions";
import type { Motion } from "@/app/yip/actions/motions";
import { raiseMotion } from "@/app/yip/actions/motions";
import type { Database } from "@/types/yip/database";

type MinistryType = Database["yip"]["Enums"]["ministry_type"];

interface MotionClientProps {
  eventId: string;
  participantId: string;
  participantRole: Database["yip"]["Enums"]["parliament_role"] | null;
  partySide: Database["yip"]["Enums"]["party_side"] | null;
  myMotions: Motion[];
  cutoffAt: string | null;
}

function formatRelativeDeadline(iso: string): string {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.round((target - now) / 60000);
  if (diffMin < 0) return "deadline passed";
  if (diffMin < 60) return `${diffMin}m left`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  if (hours < 24) return `${hours}h ${mins}m left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

export function MotionClient({
  eventId,
  participantId,
  myMotions,
  cutoffAt,
}: MotionClientProps) {
  const router = useRouter();
  const [motionType, setMotionType] = useState<MotionType | "">("");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [ministry, setMinistry] = useState<MinistryType | "">("");
  const [isPending, startTransition] = useTransition();

  const meta = motionType ? motionMeta(motionType) : null;
  const ministryRequired = meta?.needsMinistry ?? false;

  const cutoffPassed = cutoffAt
    ? Date.now() > new Date(cutoffAt).getTime()
    : false;

  function handleSubmit() {
    if (!motionType) {
      toast.error("Select a motion type");
      return;
    }
    if (subject.trim().length < 5) {
      toast.error("Subject must be at least 5 characters");
      return;
    }
    if (details.trim().length < 20) {
      toast.error("Details must be at least 20 characters");
      return;
    }
    if (ministryRequired && !ministry) {
      toast.error("This motion type requires a target ministry");
      return;
    }

    startTransition(async () => {
      const result = await raiseMotion({
        eventId,
        participantId,
        motionType: motionType as MotionType,
        subject,
        details,
        directedToMinistry: ministryRequired ? (ministry as MinistryType) : null,
      });
      if (result.success) {
        toast.success("Motion raised. The Speaker will review it.");
        setMotionType("");
        setSubject("");
        setDetails("");
        setMinistry("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/yip/me"
          className="text-xs text-gray-500 hover:text-[#FF9933]"
        >
          &larr; Back to my dashboard
        </Link>
        <h1 className="mt-1 text-xl font-bold text-gray-900 flex items-center gap-2">
          <Megaphone className="size-5 text-[#FF9933]" />
          Raise a Motion
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          As an MP, raise parliamentary motions for the Speaker&apos;s
          consideration.
        </p>
      </div>

      {/* Cutoff awareness */}
      {cutoffAt && !cutoffPassed && (
        <Card className="border-amber-200/60 bg-amber-50/40">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-amber-600" />
              <p className="text-xs text-amber-800">
                Motions deadline: {new Date(cutoffAt).toLocaleString("en-IN")}{" "}
                <span className="font-semibold">
                  ({formatRelativeDeadline(cutoffAt)})
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {cutoffPassed && (
        <Card className="border-red-200/60 bg-red-50/40">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-red-600" />
              <p className="text-sm font-medium text-red-800">
                Deadline passed. New motions can no longer be raised for this
                event.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* My prior motions */}
      {myMotions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Your Motions ({myMotions.length})
          </h2>
          {myMotions.map((m) => {
            const typeMeta = motionMeta(m.motion_type);
            const statusLabel =
              MOTION_STATUS_LABELS[m.status] ??
              MOTION_STATUS_LABELS.submitted;
            const statusClassName =
              MOTION_STATUS_COLORS[m.status] ??
              MOTION_STATUS_COLORS.submitted;
            return (
              <Card key={m.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#FF9933]">
                        {typeMeta?.label ?? m.motion_type}
                      </p>
                      <p className="text-sm font-semibold text-gray-900 mt-0.5">
                        {m.subject}
                      </p>
                      {m.details && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-3">
                          {m.details}
                        </p>
                      )}
                      {m.speaker_note && (
                        <div className="mt-2 rounded-md bg-blue-50 p-2">
                          <p className="text-[11px] font-medium text-blue-700">
                            Speaker&apos;s note:
                          </p>
                          <p className="text-xs text-blue-800 mt-0.5">
                            {m.speaker_note}
                          </p>
                        </div>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] shrink-0 ${statusClassName}`}
                    >
                      {m.status === "admitted" && (
                        <CheckCircle2 className="size-3 mr-0.5" />
                      )}
                      {statusLabel}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Submission form */}
      {!cutoffPassed && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div>
              <Label htmlFor="motion-type" className="text-sm font-medium">
                Motion Type *
              </Label>
              <select
                id="motion-type"
                value={motionType}
                onChange={(e) =>
                  setMotionType(e.target.value as MotionType)
                }
                className="mt-1.5 flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              >
                <option value="">Select a motion type...</option>
                {MOTION_TYPES.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.label}
                  </option>
                ))}
              </select>
              {meta && (
                <p className="mt-1.5 text-xs text-gray-500">
                  {meta.description}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="subject" className="text-sm font-medium">
                Subject *
              </Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="A short title for your motion"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="details" className="text-sm font-medium">
                Details *
              </Label>
              <Textarea
                id="details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe the matter and why it warrants attention (min 20 characters)..."
                className="mt-1.5"
                rows={5}
              />
              <p className="mt-1 text-xs text-gray-400">
                {details.trim().length}/20 characters minimum
              </p>
            </div>

            {ministryRequired && (
              <div>
                <Label htmlFor="ministry" className="text-sm font-medium">
                  Directed to Ministry *
                </Label>
                <select
                  id="ministry"
                  value={ministry}
                  onChange={(e) =>
                    setMinistry(e.target.value as MinistryType)
                  }
                  className="mt-1.5 flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                >
                  <option value="">Select a ministry...</option>
                  {MINISTRIES.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={
                isPending ||
                !motionType ||
                subject.trim().length < 5 ||
                details.trim().length < 20 ||
                (ministryRequired && !ministry)
              }
              className="w-full bg-[#FF9933] hover:bg-[#E68A2E]"
            >
              {isPending ? (
                "Raising motion..."
              ) : (
                <>
                  <Send className="size-4 mr-1.5" />
                  Raise Motion
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
