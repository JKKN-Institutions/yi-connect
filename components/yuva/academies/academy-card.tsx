import Image from "next/image";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Shared shape the academy UI components render — assembled by the RSC pages
 * from yuva.academies + yi.institutions + yi_directory.people lookups.
 */
export type AcademySummary = {
  id: string;
  chapter: string;
  display_name: string;
  institution_name: string | null;
  is_active: boolean;
  logo_url: string | null;
  capacity_norm: number;
  qualitative_notes: string | null;
  coordinator: { name: string; email: string | null } | null;
};

/** Logo thumb with branded fallback (server-safe, used in lists + cards). */
export function AcademyLogo({
  url,
  name,
  size = 48,
  className,
}: {
  url: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  if (!url) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-amber-500/10",
          className
        )}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <Building2 className="size-1/2 text-amber-600" />
      </div>
    );
  }
  return (
    <Image
      src={url}
      alt={`${name} logo`}
      width={size}
      height={size}
      unoptimized
      className={cn(
        "shrink-0 rounded-lg border border-slate-200 bg-white object-contain",
        className
      )}
    />
  );
}

/**
 * Presentational academy card (chapter dashboard + chapter academy view).
 * Server-safe — interactivity (toggles, dialogs) is composed around it.
 */
export function AcademyCard({
  academy,
  children,
}: {
  academy: AcademySummary;
  children?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-4 p-5">
        <AcademyLogo url={academy.logo_url} name={academy.display_name} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-slate-900">
              {academy.display_name}
            </h3>
            <Badge
              variant={academy.is_active ? "default" : "secondary"}
              className={
                academy.is_active
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-100"
              }
            >
              {academy.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            Yi {academy.chapter} ·{" "}
            {academy.institution_name ?? "No institution attached"}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Capacity norm: {academy.capacity_norm} seats ·{" "}
            {academy.coordinator
              ? `Coordinator: ${academy.coordinator.name}`
              : "No coordinator assigned"}
          </p>
        </div>
      </div>
      {children ? (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
