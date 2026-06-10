import { cn } from "@/lib/utils";
import {
  CATEGORY_LABELS,
  type ProgramCategory,
} from "@/lib/yuva/constants";

/**
 * Category badge for the 7 national Program Creation Template categories.
 * Server-component-safe (no client hooks).
 */

const CATEGORY_STYLES: Record<ProgramCategory, string> = {
  entrepreneurship: "bg-amber-100 text-amber-800 border-amber-200",
  innovation: "bg-violet-100 text-violet-800 border-violet-200",
  learning: "bg-sky-100 text-sky-800 border-sky-200",
  accessibility: "bg-teal-100 text-teal-800 border-teal-200",
  climate_change: "bg-green-100 text-green-800 border-green-200",
  health: "bg-rose-100 text-rose-800 border-rose-200",
  road_safety: "bg-orange-100 text-orange-800 border-orange-200",
};

export function CategoryBadge({
  category,
  className,
}: {
  category: ProgramCategory;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        CATEGORY_STYLES[category] ?? "bg-slate-100 text-slate-700 border-slate-200",
        className
      )}
    >
      {CATEGORY_LABELS[category] ?? category}
    </span>
  );
}
