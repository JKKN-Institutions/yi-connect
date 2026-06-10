"use client";

/**
 * Session materials list (Phase 11) — mentor/manager surface. Download via
 * the gated signed-URL action; delete with confirm. Students see their own
 * read-only list on the Phase 10 program page (different action path).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Loader2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  deleteMaterial,
  getMaterialSignedUrl,
} from "@/app/youth-academy/actions/materials";
import { Button } from "@/components/ui/button";

export type MaterialListItem = {
  id: string;
  title: string;
  created_at: string;
  uploaded_by_name: string | null;
};

export function MaterialsList({
  materials,
  canDelete = false,
}: {
  materials: MaterialListItem[];
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (materials.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
        <FileText className="mx-auto size-6 text-slate-400" />
        <p className="mt-2 text-sm text-slate-500">
          No materials uploaded for this session yet.
        </p>
      </div>
    );
  }

  async function onDownload(id: string) {
    setBusyId(id);
    const result = await getMaterialSignedUrl(id);
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    window.open(result.data.url, "_blank", "noopener,noreferrer");
  }

  async function onDelete(item: MaterialListItem) {
    if (
      !window.confirm(
        `Delete "${item.title}"? Students will no longer be able to download it.`
      )
    ) {
      return;
    }
    setBusyId(item.id);
    const result = await deleteMaterial(item.id);
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Material deleted.");
    router.refresh();
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {materials.map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
              <FileText className="size-4 text-slate-600" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {item.title}
              </p>
              <p className="text-xs text-slate-500">
                {new Date(item.created_at).toLocaleDateString([], {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {item.uploaded_by_name ? ` · ${item.uploaded_by_name}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busyId === item.id}
              onClick={() => onDownload(item.id)}
            >
              {busyId === item.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Download
            </Button>
            {canDelete && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busyId === item.id}
                onClick={() => onDelete(item)}
                className="text-rose-700 hover:bg-rose-50"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
