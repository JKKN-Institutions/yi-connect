"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Landmark, ArrowLeft, Check, RotateCcw } from "lucide-react";
import { setCabinetMinistries } from "@/app/yip/actions/cabinet";

/**
 * Per-event cabinet editor. One ministry per line. Empty save → reset to the
 * MINISTRIES default. Other events are unaffected.
 */
export function CabinetClient({
  eventId,
  initialNames,
  configured,
  defaultCount,
}: {
  eventId: string;
  initialNames: string[];
  configured: boolean;
  defaultCount: number;
}) {
  const [text, setText] = useState(initialNames.join("\n"));
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const count = lines.length;

  const save = () =>
    startTransition(async () => {
      setMsg(null);
      const res = await setCabinetMinistries(eventId, lines);
      if (res.success) {
        setMsg({
          type: "ok",
          text: `Saved — ${res.count} cabinet ministers for this event.`,
        });
      } else {
        setMsg({ type: "err", text: res.error ?? "Could not save." });
      }
    });

  const reset = () =>
    startTransition(async () => {
      setMsg(null);
      const res = await setCabinetMinistries(eventId, []);
      if (res.success) {
        setText("");
        setMsg({
          type: "ok",
          text: `Reset to the default cabinet (${defaultCount} ministers).`,
        });
      } else {
        setMsg({ type: "err", text: res.error ?? "Could not reset." });
      }
    });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href={`/yip/dashboard/events/${eventId}/control`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="size-4" /> Back to control
      </Link>

      <Card>
        <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-sky-400" />
        <CardContent className="space-y-4 pt-4 pb-5">
          <div className="flex items-center gap-2">
            <Landmark className="size-5 text-indigo-600" />
            <h1 className="text-base font-bold text-gray-900">
              Cabinet ministers for this event
            </h1>
          </div>
          <p className="text-sm text-gray-600">
            Type one ministry per line. These are the cabinet posts students vote
            for and the Prime Minister picks from (the opposition mirrors them as
            shadow ministers). Leave it on the default if you&apos;re not sure —
            other chapters are not affected.
          </p>

          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-gray-300 p-3 text-sm font-medium focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
              placeholder={"Home Affairs\nFinance & Planning\nEducation\nHealth\n..."}
            />
            <p className="mt-1 text-xs text-gray-500">
              {count} {count === 1 ? "ministry" : "ministries"}
              {configured ? "" : " · currently using the default"}
            </p>
          </div>

          {msg && (
            <p
              className={`text-sm ${msg.type === "ok" ? "text-emerald-700" : "text-red-600"}`}
            >
              {msg.text}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={save}
              disabled={isPending || count === 0}
            >
              <Check className="size-4" /> Save cabinet
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={reset}
              disabled={isPending}
            >
              <RotateCcw className="size-4" /> Reset to default
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
