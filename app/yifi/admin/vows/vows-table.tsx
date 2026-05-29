"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateVowTile } from "./actions";

export type VowCategory = "business" | "family_health" | "yi";

export interface AdminVow {
  id: string;
  category: VowCategory | string;
  vow_text: string;
  status: string;
  witness_accepted: boolean;
  tile_engraved: boolean;
  tile_placed: boolean;
  tile_reclaimed: boolean;
  completion_date: string | null;
  created_at: string;
  registrant: {
    id: string;
    full_name: string;
    organisation: string | null;
  } | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  business: "Business",
  family_health: "Family & Health",
  yi: "Yi",
};

const FILTERS: { key: "all" | VowCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "business", label: "Business" },
  { key: "family_health", label: "Family & Health" },
  { key: "yi", label: "Yi" },
];

function categoryChipClasses(category: string): string {
  switch (category) {
    case "business":
      return "bg-[#FD7215]/20 text-[#FD7215]";
    case "family_health":
      return "bg-[#229434]/20 text-[#229434]";
    case "yi":
      return "bg-cyan-500/20 text-cyan-400";
    default:
      return "bg-white/10 text-white/60";
  }
}

export function VowsTable({ rows }: { rows: AdminVow[] }) {
  const [filter, setFilter] = useState<"all" | VowCategory>("all");

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.category === filter)),
    [rows, filter],
  );

  return (
    <div className="space-y-4">
      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                active
                  ? "bg-[#FD7215] border-[#FD7215] text-white"
                  : "bg-white/5 border-white/10 text-white/60 hover:border-white/30"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
          <p className="text-white/40 text-sm">No vows in this category.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((vow) => (
            <VowRow key={vow.id} vow={vow} />
          ))}
        </div>
      )}
    </div>
  );
}

function VowRow({ vow }: { vow: AdminVow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(next: { engraved?: boolean; placed?: boolean }) {
    setError(null);
    const engraved = next.engraved ?? vow.tile_engraved;
    const placed = next.placed ?? vow.tile_placed;
    startTransition(async () => {
      const res = await updateVowTile(vow.id, engraved, placed);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const label = CATEGORY_LABELS[vow.category] ?? vow.category;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${categoryChipClasses(vow.category)}`}
        >
          {label}
        </span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            vow.status === "completed"
              ? "bg-[#229434]/20 text-[#229434]"
              : vow.status === "in_progress"
                ? "bg-[#FD7215]/20 text-[#FD7215]"
                : "bg-white/10 text-white/50"
          }`}
        >
          {vow.status === "completed"
            ? "Kept"
            : vow.status === "in_progress"
              ? "In progress"
              : "Active"}
        </span>
        {vow.witness_accepted && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">
            Witnessed
          </span>
        )}
      </div>

      <p className="text-white text-base font-medium mb-3">
        &ldquo;{vow.vow_text}&rdquo;
      </p>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-white/40 text-xs">
          {vow.registrant?.full_name ?? "Unknown"}
          {vow.registrant?.organisation ? (
            <span className="text-white/30"> · {vow.registrant.organisation}</span>
          ) : null}
        </p>

        <div className="flex items-center gap-2">
          <ToggleButton
            label="Engraved"
            active={vow.tile_engraved}
            disabled={isPending}
            onClick={() => toggle({ engraved: !vow.tile_engraved })}
          />
          <ToggleButton
            label="Placed"
            active={vow.tile_placed}
            disabled={isPending}
            onClick={() => toggle({ placed: !vow.tile_placed })}
          />
        </div>
      </div>

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}

function ToggleButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
        active
          ? "bg-[#229434] border-[#229434] text-white"
          : "bg-transparent border-white/20 text-white/60 hover:border-white/40"
      }`}
    >
      {label}
    </button>
  );
}
