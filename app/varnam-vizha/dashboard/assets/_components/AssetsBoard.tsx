"use client";

import { useMemo, useState, useTransition } from "react";
import {
  removeAsset,
  setAssetStatus,
} from "@/lib/varnam/actions/manage-assets";

export type AssetItem = {
  id: string;
  title: string;
  kind: string;
  url: string | null;
  status: string;
  notes: string | null;
  createdAt: string | null;
  eventId: string | null;
  eventTitle: string | null;
};

// Keep in sync with ASSET_STATUSES / ASSET_KINDS in manage-assets.ts
// (the server actions enforce the real allowed sets).
const STATUS_META: { value: string; label: string; chip: string }[] = [
  { value: "draft", label: "Draft", chip: "bg-[#3B0A45]/8 text-[#3B0A45]/70" },
  { value: "review", label: "In review", chip: "bg-[#F4A300]/15 text-[#8a5d00]" },
  { value: "approved", label: "Approved", chip: "bg-[#0CA4A5]/10 text-[#0a8485]" },
  { value: "published", label: "Published", chip: "bg-[#D6336C]/10 text-[#b02a59]" },
];

const KIND_META: { value: string; label: string }[] = [
  { value: "poster", label: "Poster" },
  { value: "reel", label: "Reel" },
  { value: "video", label: "Video" },
  { value: "script", label: "Script" },
  { value: "photo", label: "Photo" },
  { value: "other", label: "Other" },
];

const statusMeta = (s: string) =>
  STATUS_META.find((m) => m.value === s) ?? STATUS_META[0];
const kindLabel = (k: string) =>
  KIND_META.find((m) => m.value === k)?.label ?? k;

const filterChipCls = (active: boolean) =>
  `rounded-full px-3 py-1 text-xs font-medium transition ${
    active
      ? "bg-[#3B0A45] text-white"
      : "border border-[#3B0A45]/15 bg-white text-[#2B0A33]/70 hover:bg-[#3B0A45]/5"
  }`;

function AssetCard({
  asset,
  canManage,
}: {
  asset: AssetItem;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const meta = statusMeta(asset.status);

  return (
    <li className="rounded-2xl border border-[#3B0A45]/10 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-[#2B0A33]">{asset.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex rounded-full bg-[#0CA4A5]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#0a8485]">
              {kindLabel(asset.kind)}
            </span>
            {asset.eventTitle ? (
              <span className="inline-flex max-w-[14rem] truncate rounded-full bg-[#3B0A45]/8 px-2.5 py-0.5 text-[11px] font-medium text-[#3B0A45]/70">
                {asset.eventTitle}
              </span>
            ) : (
              <span className="inline-flex rounded-full bg-[#3B0A45]/8 px-2.5 py-0.5 text-[11px] font-medium text-[#3B0A45]/50">
                Whole festival
              </span>
            )}
            {!canManage && (
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${meta.chip}`}
              >
                {meta.label}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {asset.url && (
            <a
              href={asset.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-[#0CA4A5]/30 px-3 py-1 text-xs font-medium text-[#0a8485] transition hover:bg-[#0CA4A5]/5"
            >
              Open ↗
            </a>
          )}
          {canManage && (
            <>
              <select
                aria-label={`Status of ${asset.title}`}
                value={asset.status}
                disabled={pending}
                onChange={(e) => {
                  const next = e.target.value;
                  setError("");
                  startTransition(async () => {
                    const res = await setAssetStatus(asset.id, next);
                    if (!res.ok) setError(res.message);
                  });
                }}
                className={`rounded-full border-0 px-2.5 py-1 text-[11px] font-medium outline-none transition focus:ring-2 focus:ring-[#D6336C]/20 disabled:opacity-60 ${meta.chip}`}
              >
                {STATUS_META.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`Remove "${asset.title}" from the library? This can't be undone.`))
                    return;
                  setError("");
                  startTransition(async () => {
                    const res = await removeAsset(asset.id);
                    if (!res.ok) setError(res.message);
                  });
                }}
                className="rounded-full border border-[#D6336C]/30 px-3 py-1 text-xs font-medium text-[#b02a59] transition hover:bg-[#D6336C]/5 disabled:opacity-60"
              >
                {pending ? "…" : "Remove"}
              </button>
            </>
          )}
        </div>
      </div>

      {asset.notes && (
        <p className="mt-2 text-sm text-[#2B0A33]/60">{asset.notes}</p>
      )}
      {error && (
        <p className="mt-2 text-xs font-medium text-[#D6336C]">{error}</p>
      )}
    </li>
  );
}

export function AssetsBoard({
  assets,
  canManage,
}: {
  assets: AssetItem[];
  canManage: boolean;
}) {
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Pipeline counts are over ALL assets (filters don't change the headline).
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of STATUS_META) c[s.value] = 0;
    for (const a of assets) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [assets]);

  const visible = assets.filter(
    (a) =>
      (kindFilter === "all" || a.kind === kindFilter) &&
      (statusFilter === "all" || a.status === statusFilter)
  );

  return (
    <section>
      {/* Status pipeline */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_META.map((s, i) => (
          <span key={s.value} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${s.chip}`}
            >
              {s.label}
              <span className="font-semibold">{counts[s.value] ?? 0}</span>
            </span>
            {i < STATUS_META.length - 1 && (
              <span aria-hidden className="text-[#3B0A45]/25">
                →
              </span>
            )}
          </span>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-[#2B0A33]/40">
          Type
        </span>
        <button
          type="button"
          onClick={() => setKindFilter("all")}
          className={filterChipCls(kindFilter === "all")}
        >
          All
        </button>
        {KIND_META.map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => setKindFilter(k.value)}
            className={filterChipCls(kindFilter === k.value)}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-[#2B0A33]/40">
          Status
        </span>
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={filterChipCls(statusFilter === "all")}
        >
          All
        </button>
        {STATUS_META.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatusFilter(s.value)}
            className={filterChipCls(statusFilter === s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      {assets.length === 0 ? (
        <div className="rounded-2xl border border-[#3B0A45]/10 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-[#2B0A33]/50">
            Drop your poster/reel Drive links here so approvals stop living in
            WhatsApp scrollback.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-[#3B0A45]/10 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-[#2B0A33]/50">
            Nothing matches these filters — try switching back to All.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((a) => (
            <AssetCard key={a.id} asset={a} canManage={canManage} />
          ))}
        </ul>
      )}
    </section>
  );
}
