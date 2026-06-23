"use client";

// Per-event award override: a chapter can "recognise more" on its own event —
// raise the recipient count or turn an award off for THIS event only, without
// changing the global defaults. Writes yip.event_award_config, which the results
// engine reads on the next Compute Results. Falls back to the global default
// when left untouched.

import { useState, useTransition } from "react";
import {
  setEventAwardConfig,
  type EventAwardRow,
} from "@/app/yip/actions/admin-awards";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Trophy, ChevronDown, ChevronRight, Loader2, Check } from "lucide-react";

export function EventAwardConfig({
  eventId,
  initialConfig,
  defaultOpen = false,
}: {
  eventId: string;
  initialConfig: EventAwardRow[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [rows, setRows] = useState(initialConfig);
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (initialConfig.length === 0) return null;

  function save(
    awardKey: string,
    patch: { recipients?: number | null; is_active?: boolean | null }
  ) {
    setError(null);
    setBusyKey(awardKey);
    startTransition(async () => {
      const res = await setEventAwardConfig(eventId, awardKey, patch);
      setBusyKey(null);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.award_key === awardKey
            ? {
                ...r,
                effective_recipients:
                  patch.recipients != null
                    ? patch.recipients
                    : r.effective_recipients,
                effective_active:
                  patch.is_active != null
                    ? patch.is_active
                    : r.effective_active,
                has_override: true,
              }
            : r
        )
      );
      setFlashKey(awardKey);
      setTimeout(() => setFlashKey(null), 1500);
    });
  }

  const overrides = rows.filter((r) => r.has_override).length;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        {open ? (
          <ChevronDown className="size-4 text-[#1a1a3e]/50" />
        ) : (
          <ChevronRight className="size-4 text-[#1a1a3e]/50" />
        )}
        <Trophy className="size-4 text-[#FF9933]" />
        <span className="text-sm font-semibold text-[#1a1a3e]">
          Award recipients for this event
        </span>
        {overrides > 0 && (
          <span className="rounded-full bg-[#FF9933]/15 px-2 py-0.5 text-[10px] font-semibold text-[#b35e00]">
            {overrides} overridden
          </span>
        )}
        <span className="ml-auto text-xs text-[#1a1a3e]/45">
          recognise more — applies on next compute
        </span>
      </button>

      {open && (
        <CardContent className="pt-0">
          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="divide-y divide-[#1a1a3e]/10 rounded-lg border border-[#1a1a3e]/10">
            {rows.map((a) => {
              const rowBusy = busyKey === a.award_key && pending;
              return (
                <div
                  key={a.award_key}
                  className={`flex items-center gap-3 px-3 py-2 text-sm ${
                    a.effective_active ? "" : "opacity-60"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-[#1a1a3e]">{a.label}</span>
                    {a.has_override && (
                      <span className="ml-1.5 text-[10px] font-semibold text-[#b35e00]">
                        (event override)
                      </span>
                    )}
                    {a.is_team && (
                      <span className="ml-1.5 text-[10px] text-[#138808]">
                        team
                      </span>
                    )}
                  </div>
                  {flashKey === a.award_key && (
                    <Check className="size-4 shrink-0 text-[#138808]" />
                  )}
                  {rowBusy && (
                    <Loader2 className="size-4 shrink-0 animate-spin text-[#1a1a3e]/40" />
                  )}
                  <label className="flex items-center gap-1.5 text-xs text-[#1a1a3e]/70">
                    Top
                    <input
                      type="number"
                      min={1}
                      max={50}
                      defaultValue={a.effective_recipients}
                      disabled={rowBusy || a.is_team}
                      title={
                        a.is_team
                          ? "Team award — whole committee co-wins"
                          : "Recipients for this event"
                      }
                      onBlur={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (
                          Number.isFinite(n) &&
                          n >= 1 &&
                          n <= 50 &&
                          n !== a.effective_recipients
                        )
                          save(a.award_key, { recipients: n });
                      }}
                      className="w-14 rounded-md border border-[#1a1a3e]/15 px-2 py-1 text-center disabled:bg-[#1a1a3e]/5 disabled:text-[#1a1a3e]/40"
                    />
                  </label>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={a.effective_active}
                    aria-label={`${a.effective_active ? "Disable" : "Enable"} ${a.label} for this event`}
                    disabled={rowBusy}
                    onClick={() =>
                      save(a.award_key, { is_active: !a.effective_active })
                    }
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                      a.effective_active ? "bg-[#138808]" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block size-3.5 transform rounded-full bg-white shadow transition-transform ${
                        a.effective_active ? "translate-x-4" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
