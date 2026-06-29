"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Button, buttonVariants } from "@/components/yip/ui/button";
import {
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ArrowRight,
  Compass,
} from "lucide-react";
import {
  getEventReadiness,
  type EventReadiness,
} from "@/app/yip/actions/event-readiness";
import { INK, SAFFRON, SERIF } from "@/app/yip/me/credential-ui";

/**
 * "Mission Control" — a NON-BLOCKING, volunteer-facing readiness board at the
 * top of the live control panel. It reads the event's real data, shows one
 * "your next step" pointer + a full ✅/⚠ checklist with deep-links, and
 * auto-refreshes. It never blocks any action — purely a guide.
 */
export function MissionControl({ eventId }: { eventId: string }) {
  const [data, setData] = useState<EventReadiness | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const r = await getEventReadiness(eventId);
      setData(r);
      setLoaded(true);
    });
  }, [eventId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  // Organisers only (null = no manage access). Render nothing otherwise.
  if (loaded && !data) return null;

  const pct = data
    ? Math.round((data.okCount / Math.max(1, data.totalCount)) * 100)
    : 0;

  return (
    <Card className="border-indigo-200/70 overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-sky-400" />
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Compass className="size-5 text-indigo-600" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: SAFFRON }}>READINESS</p>
              <h2 className="text-sm font-bold" style={{ ...SERIF, color: INK }}>Mission Control</h2>
              <p className="text-xs text-gray-500">
                {data
                  ? `${data.okCount} of ${data.totalCount} steps ready`
                  : "Checking readiness…"}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={load}
            disabled={isPending}
          >
            <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Next step banner */}
        {data?.nextStep ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              Your next step
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-amber-900">
                  {data.nextStep.label}
                </p>
                <p className="text-xs text-amber-700">{data.nextStep.phase}</p>
              </div>
              {data.nextStep.href && (
                <Link
                  href={data.nextStep.href}
                  className={`${buttonVariants({ size: "sm" })} shrink-0`}
                >
                  Take me there <ArrowRight className="size-3.5" />
                </Link>
              )}
            </div>
          </div>
        ) : data ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-900">
              All steps ready — you&apos;re good to go!
            </p>
          </div>
        ) : null}

        <p className="text-[11px] text-gray-400">
          This is a guide — it never blocks you. You can run any step at any time.
        </p>

        {/* Full checklist toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between rounded-md px-1 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <span>{expanded ? "Hide" : "Show"} full checklist</span>
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>

        {expanded && data && (
          <div className="space-y-4">
            {data.phases.map((phase) => (
              <div key={phase.name}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {phase.name}
                </p>
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                  {phase.items.map((it) => (
                    <div key={it.key} className="flex items-center gap-3 px-3 py-2">
                      {it.ok ? (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm ${it.ok ? "text-gray-700" : "font-medium text-gray-900"}`}
                        >
                          {it.label}
                        </p>
                        <p className="text-xs text-gray-500">{it.detail}</p>
                      </div>
                      {!it.ok && it.href && (
                        <Link
                          href={it.href}
                          className="shrink-0 whitespace-nowrap text-xs font-medium text-indigo-600 hover:underline"
                        >
                          Fix this →
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
