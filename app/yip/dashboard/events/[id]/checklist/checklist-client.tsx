"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, Loader2, ListChecks, Printer } from "lucide-react";
import {
  toggleChecklistItem,
  seedChecklistForEvent,
  type ChecklistItem,
} from "@/app/actions/checklist";

const CATEGORY_ORDER = [
  "Pre-Session Preparation",
  "Venue & Infrastructure",
  "On-Ground Execution",
  "Logistics & Hospitality",
  "Communication & Protocol",
  "Post-Session",
];

const CATEGORY_COLORS: Record<string, { accent: string; bg: string }> = {
  "Pre-Session Preparation": { accent: "bg-amber-500", bg: "bg-amber-50" },
  "Venue & Infrastructure": { accent: "bg-blue-500", bg: "bg-blue-50" },
  "On-Ground Execution": { accent: "bg-[#138808]", bg: "bg-[#138808]/5" },
  "Logistics & Hospitality": { accent: "bg-violet-500", bg: "bg-violet-50" },
  "Communication & Protocol": { accent: "bg-cyan-500", bg: "bg-cyan-50" },
  "Post-Session": { accent: "bg-rose-500", bg: "bg-rose-50" },
};

export function ChecklistClient({
  eventId,
  eventName,
  initialItems,
}: {
  eventId: string;
  eventName: string;
  initialItems: ChecklistItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Group by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: items.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  const uncategorized = items.filter(
    (i) => !i.category || !CATEGORY_ORDER.includes(i.category)
  );
  if (uncategorized.length > 0) {
    grouped.push({ category: "Other", items: uncategorized });
  }

  const totalDone = items.filter((i) => i.is_completed).length;
  const totalItems = items.length;
  const overallPct = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0;

  function toggle(id: string, done: boolean) {
    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              is_completed: done,
              completed_at: done ? new Date().toISOString() : null,
            }
          : i
      )
    );

    startTransition(async () => {
      const res = await toggleChecklistItem(id, eventId, done);
      if (!res.success) {
        setError(res.error);
        // Revert
        setItems((prev) =>
          prev.map((i) =>
            i.id === id ? { ...i, is_completed: !done } : i
          )
        );
      }
    });
  }

  function handleSeed() {
    startTransition(async () => {
      const res = await seedChecklistForEvent(eventId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      // Refresh the page to pull seeded items
      window.location.reload();
    });
  }

  if (items.length === 0) {
    return (
      <div className="max-w-[1000px] mx-auto px-6 py-8 space-y-4">
        <h1 className="text-3xl font-bold text-[#1a1a3e] flex items-center gap-2">
          <ListChecks className="size-7 text-[#FF9933]" />
          Chapter Execution Checklist
        </h1>
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-[#1a1a3e]/60 mb-4">
              This event was created before auto-seeding was enabled. Seed the
              33-item handbook checklist now?
            </p>
            <Button
              onClick={handleSeed}
              disabled={pending}
              className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
            >
              {pending && <Loader2 className="size-4 mr-2 animate-spin" />}
              Seed Checklist from Handbook
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-8 space-y-6 print:py-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 print:mb-2">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1a3e] tracking-tight flex items-center gap-2">
            <ListChecks className="size-7 text-[#FF9933]" />
            Execution Checklist
          </h1>
          <p className="text-sm text-[#1a1a3e]/60 mt-1">
            {eventName} · Handbook pages 45–46 · {totalDone}/{totalItems} complete
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => window.print()}
          className="print:hidden"
        >
          <Printer className="size-4 mr-2" />
          Print
        </Button>
      </div>

      {/* Overall progress */}
      <div className="relative h-2 rounded-full bg-[#1a1a3e]/5 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#FF9933] via-[#FF9933] to-[#138808] transition-all duration-500"
          style={{ width: `${overallPct}%` }}
        />
      </div>
      <div className="flex justify-between items-center text-xs text-[#1a1a3e]/60">
        <span>{overallPct}% complete</span>
        <span>{totalItems - totalDone} items remaining</span>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Category sections */}
      {grouped.map(({ category, items: catItems }) => {
        const done = catItems.filter((i) => i.is_completed).length;
        const pct = Math.round((done / catItems.length) * 100);
        const colors = CATEGORY_COLORS[category] ?? { accent: "bg-gray-400", bg: "bg-gray-50" };

        return (
          <Card key={category} className="overflow-hidden">
            <div className={`h-1 ${colors.accent}`} />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-[#1a1a3e]">
                  {category}
                </CardTitle>
                <Badge variant="secondary" className="text-[11px] font-mono">
                  {done}/{catItems.length} · {pct}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-2 space-y-0.5">
              {catItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id, !item.is_completed)}
                  disabled={pending}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:${colors.bg} ${
                    item.is_completed ? "opacity-60" : ""
                  }`}
                >
                  {item.is_completed ? (
                    <CheckCircle2 className="size-5 text-[#138808] shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="size-5 text-[#1a1a3e]/20 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm ${
                        item.is_completed
                          ? "line-through text-[#1a1a3e]/50"
                          : "text-[#1a1a3e] font-medium"
                      }`}
                    >
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="text-xs text-[#1a1a3e]/60 mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
