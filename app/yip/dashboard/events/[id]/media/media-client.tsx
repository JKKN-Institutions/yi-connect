"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/yip/supabase/client";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Input } from "@/components/yip/ui/input";
import { Textarea } from "@/components/yip/ui/textarea";
import {
  Images,
  Upload,
  Loader2,
  Star,
  StarOff,
  Trash2,
  Download,
  Search,
  Film,
  FileText,
  ImageIcon,
  Eye,
  EyeOff,
  Lock,
  CheckSquare,
  Square,
  X,
  Camera,
  HardDrive,
  Users as UsersIcon,
} from "lucide-react";
import {
  MEDIA_KINDS,
  MEDIA_VISIBILITY_LABELS,
  MEDIA_VISIBILITY_COLORS,
  MEDIA_VISIBILITY_DESCRIPTIONS,
  MEDIA_ACCEPTED_MIME,
  STORAGE_BUCKET,
  buildStoragePath,
  formatBytes,
  mimeToKind,
  type EventMedia,
  type MediaKind,
  type MediaVisibility,
} from "@/lib/yip/media";
import {
  registerUploadedMedia,
  updateMediaCaption,
  setCoverImage,
  clearCoverImage,
  setVisibility,
  bulkSetVisibility,
  deleteMedia,
  bulkDeleteMedia,
} from "@/app/yip/actions/media";

type Stats = {
  total: number;
  total_size_bytes: number;
  photos: number;
  videos: number;
  documents: number;
  public: number;
  yi_internal: number;
  organizer_only: number;
};

type UploadItem = {
  id: string;
  file: File;
  progress: number; // 0..100
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
};

const PARALLEL_UPLOADS = 3;

export function MediaClient({
  eventId,
  eventName,
  initialMedia,
  initialStats,
}: {
  eventId: string;
  eventName: string;
  initialMedia: EventMedia[];
  initialStats: Stats;
}) {
  const [media, setMedia] = useState<EventMedia[]>(initialMedia);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [kindFilter, setKindFilter] = useState<MediaKind | "all">("all");
  const [visFilter, setVisFilter] = useState<MediaVisibility | "all">("all");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    caption: string;
    photographer_name: string;
  }>({ caption: "", photographer_name: "" });
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const cover = media.find((m) => m.is_cover) ?? null;

  // ── Filters + search ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    return media.filter((m) => {
      if (kindFilter !== "all" && m.kind !== kindFilter) return false;
      if (visFilter !== "all" && m.visibility !== visFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = [
          m.caption ?? "",
          m.photographer_name ?? "",
          m.file_name,
          ...(m.tags ?? []),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [media, kindFilter, visFilter, query]);

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  }

  function bumpStatsOnAdd(row: EventMedia) {
    setStats((s) => ({
      ...s,
      total: s.total + 1,
      total_size_bytes: s.total_size_bytes + (row.size_bytes ?? 0),
      photos: s.photos + (row.kind === "photo" ? 1 : 0),
      videos: s.videos + (row.kind === "video" ? 1 : 0),
      documents: s.documents + (row.kind === "document" ? 1 : 0),
      public: s.public + (row.visibility === "public" ? 1 : 0),
      yi_internal: s.yi_internal + (row.visibility === "yi_internal" ? 1 : 0),
      organizer_only:
        s.organizer_only + (row.visibility === "organizer_only" ? 1 : 0),
    }));
  }

  function bumpStatsOnDelete(rows: EventMedia[]) {
    setStats((s) => ({
      ...s,
      total: Math.max(0, s.total - rows.length),
      total_size_bytes: Math.max(
        0,
        s.total_size_bytes - rows.reduce((t, r) => t + (r.size_bytes ?? 0), 0)
      ),
      photos: Math.max(0, s.photos - rows.filter((r) => r.kind === "photo").length),
      videos: Math.max(0, s.videos - rows.filter((r) => r.kind === "video").length),
      documents: Math.max(
        0,
        s.documents - rows.filter((r) => r.kind === "document").length
      ),
      public: Math.max(0, s.public - rows.filter((r) => r.visibility === "public").length),
      yi_internal: Math.max(
        0,
        s.yi_internal - rows.filter((r) => r.visibility === "yi_internal").length
      ),
      organizer_only: Math.max(
        0,
        s.organizer_only -
          rows.filter((r) => r.visibility === "organizer_only").length
      ),
    }));
  }

  // ── Upload pipeline ─────────────────────────────────────────────────
  const uploadOne = useCallback(
    async (item: UploadItem) => {
      const supabase = createClient();
      const kind = mimeToKind(item.file.type);
      const storagePath = buildStoragePath(eventId, kind, item.file.name);

      setUploads((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, status: "uploading", progress: 10 } : u))
      );

      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, item.file, {
          contentType: item.file.type || undefined,
          upsert: false,
        });

      if (upErr) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === item.id
              ? { ...u, status: "error", error: upErr.message, progress: 0 }
              : u
          )
        );
        return;
      }

      setUploads((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, progress: 70 } : u))
      );

      // Try to grab image dimensions client-side for photos
      let width: number | null = null;
      let height: number | null = null;
      if (kind === "photo") {
        try {
          const dims = await readImageDimensions(item.file);
          width = dims.width;
          height = dims.height;
        } catch {
          // non-fatal
        }
      }

      const res = await registerUploadedMedia({
        event_id: eventId,
        storage_path: storagePath,
        file_name: item.file.name,
        mime_type: item.file.type || null,
        size_bytes: item.file.size,
        width,
        height,
      });

      if (!res.success) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === item.id ? { ...u, status: "error", error: res.error } : u
          )
        );
        return;
      }

      setUploads((prev) =>
        prev.map((u) =>
          u.id === item.id ? { ...u, status: "done", progress: 100 } : u
        )
      );
      setMedia((prev) => [res.data, ...prev]);
      bumpStatsOnAdd(res.data);
    },
    [eventId]
  );

  const runUploadQueue = useCallback(
    async (items: UploadItem[]) => {
      // Simple N-at-a-time worker pool
      let idx = 0;
      async function worker() {
        while (idx < items.length) {
          const myIdx = idx++;
          await uploadOne(items[myIdx]);
        }
      }
      const workers = Array.from(
        { length: Math.min(PARALLEL_UPLOADS, items.length) },
        () => worker()
      );
      await Promise.all(workers);
    },
    [uploadOne]
  );

  const handleFiles = useCallback(
    (fileList: FileList | File[] | null) => {
      if (!fileList) return;
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const newItems: UploadItem[] = files.map((f) => ({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        progress: 0,
        status: "queued",
      }));

      setUploads((prev) => [...newItems, ...prev]);
      runUploadQueue(newItems);
    },
    [runUploadQueue]
  );

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  // ── Selection ───────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelection(new Set(filtered.map((m) => m.id)));
  }

  function clearSelection() {
    setSelection(new Set());
    setSelectionMode(false);
  }

  // ── Actions ─────────────────────────────────────────────────────────
  function handleSetCover(id: string) {
    startTransition(async () => {
      const target = media.find((m) => m.id === id);
      if (!target) return;
      if (target.is_cover) {
        const res = await clearCoverImage(eventId);
        if (!res.success) return setError(res.error);
        setMedia((prev) => prev.map((m) => ({ ...m, is_cover: false })));
        showFlash("Cover cleared");
        return;
      }
      const res = await setCoverImage(id, eventId);
      if (!res.success) return setError(res.error);
      setMedia((prev) =>
        prev.map((m) => ({ ...m, is_cover: m.id === id }))
      );
      showFlash("Cover image set");
    });
  }

  function handleSetVisibility(id: string, v: MediaVisibility) {
    startTransition(async () => {
      const res = await setVisibility(id, v);
      if (!res.success) return setError(res.error);
      setMedia((prev) => {
        const prevRow = prev.find((m) => m.id === id);
        const next = prev.map((m) => (m.id === id ? res.data : m));
        if (prevRow && prevRow.visibility !== v) {
          setStats((s) => ({
            ...s,
            [prevRow.visibility]: Math.max(0, s[prevRow.visibility] - 1),
            [v]: s[v] + 1,
          }));
        }
        return next;
      });
      showFlash("Visibility updated");
    });
  }

  function handleBulkVisibility(v: MediaVisibility) {
    const ids = Array.from(selection);
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await bulkSetVisibility(ids, v, eventId);
      if (!res.success) return setError(res.error);
      setMedia((prev) => {
        const changedFrom: Record<MediaVisibility, number> = {
          public: 0,
          yi_internal: 0,
          organizer_only: 0,
        };
        const next = prev.map((m) => {
          if (!selection.has(m.id)) return m;
          if (m.visibility !== v) changedFrom[m.visibility] += 1;
          return { ...m, visibility: v };
        });
        setStats((s) => {
          const moved =
            changedFrom.public + changedFrom.yi_internal + changedFrom.organizer_only;
          return {
            ...s,
            public: Math.max(0, s.public - changedFrom.public + (v === "public" ? moved : 0)),
            yi_internal: Math.max(
              0,
              s.yi_internal -
                changedFrom.yi_internal +
                (v === "yi_internal" ? moved : 0)
            ),
            organizer_only: Math.max(
              0,
              s.organizer_only -
                changedFrom.organizer_only +
                (v === "organizer_only" ? moved : 0)
            ),
          };
        });
        return next;
      });
      showFlash(`Visibility set for ${res.data} file(s)`);
      clearSelection();
    });
  }

  function handleDeleteOne(id: string) {
    const target = media.find((m) => m.id === id);
    if (!target) return;
    if (!confirm(`Delete "${target.file_name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteMedia(id);
      if (!res.success) return setError(res.error);
      setMedia((prev) => prev.filter((m) => m.id !== id));
      bumpStatsOnDelete([target]);
      showFlash("File deleted");
    });
  }

  function handleBulkDelete() {
    const ids = Array.from(selection);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} file(s)? This cannot be undone.`)) return;
    startTransition(async () => {
      const targets = media.filter((m) => selection.has(m.id));
      const res = await bulkDeleteMedia(ids, eventId);
      if (!res.success) return setError(res.error);
      setMedia((prev) => prev.filter((m) => !selection.has(m.id)));
      bumpStatsOnDelete(targets);
      showFlash(`Deleted ${res.data} file(s)`);
      clearSelection();
    });
  }

  function startEdit(m: EventMedia) {
    setEditingId(m.id);
    setEditDraft({
      caption: m.caption ?? "",
      photographer_name: m.photographer_name ?? "",
    });
  }

  function saveEdit() {
    if (!editingId) return;
    startTransition(async () => {
      const res = await updateMediaCaption(editingId, {
        caption: editDraft.caption.trim() || null,
        photographer_name: editDraft.photographer_name.trim() || null,
      });
      if (!res.success) return setError(res.error);
      setMedia((prev) =>
        prev.map((m) => (m.id === editingId ? res.data : m))
      );
      setEditingId(null);
      showFlash("Saved");
    });
  }

  // ── CSV manifest (lightweight "Download All" alternative) ───────────
  function exportManifest() {
    const headers = [
      "file_name",
      "kind",
      "public_url",
      "caption",
      "photographer",
      "visibility",
      "size_bytes",
      "uploaded_at",
      "tags",
    ];
    const rows = media.map((m) => [
      m.file_name,
      m.kind,
      m.public_url ?? "",
      m.caption ?? "",
      m.photographer_name ?? "",
      m.visibility,
      m.size_bytes ?? "",
      m.uploaded_at,
      (m.tags ?? []).join("|"),
    ]);
    const csv = [headers, ...rows]
      .map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${eventName.replace(/[^a-z0-9]/gi, "_")}_media_manifest.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const activeUploads = uploads.filter((u) => u.status !== "done").length;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1a3e] tracking-tight flex items-center gap-2">
            <Images className="size-7 text-[#FF9933]" />
            Event Media
          </h1>
          <p className="text-sm text-[#1a1a3e]/60 mt-1">
            {eventName} &middot; Handbook p.10 &amp; p.46 &middot; Photos, videos,
            documents with branding compliance
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportManifest} disabled={media.length === 0}>
            <Download className="size-4 mr-2" />
            Export Manifest (CSV)
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
          >
            <Upload className="size-4 mr-2" />
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={MEDIA_ACCEPTED_MIME}
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
        </div>
      </div>

      {flash && (
        <div className="rounded-lg bg-[#138808]/8 border border-[#138808]/15 px-4 py-2 text-sm text-[#138808]">
          {flash}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-start justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-700/70 hover:text-red-900">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={ImageIcon}
          label="Total files"
          value={stats.total}
          sub={`${stats.photos} photos, ${stats.videos} videos, ${stats.documents} docs`}
          color="indigo"
        />
        <StatCard
          icon={HardDrive}
          label="Total size"
          value={formatBytes(stats.total_size_bytes)}
          color="blue"
        />
        <StatCard
          icon={Eye}
          label="Public"
          value={stats.public}
          sub="Safe for social media"
          color="green"
        />
        <StatCard
          icon={UsersIcon}
          label="Yi Internal"
          value={stats.yi_internal}
          sub={`${stats.organizer_only} organizer-only`}
          color="orange"
        />
      </div>

      {/* Cover section */}
      <Card className="border-[#FF9933]/30">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="relative size-24 md:size-28 rounded-lg overflow-hidden bg-[#FEFCF6] border border-[#1a1a3e]/10 flex items-center justify-center shrink-0">
              {cover && cover.kind === "photo" && cover.public_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover.public_url}
                  alt={cover.caption ?? cover.file_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Star className="size-8 text-[#FF9933]/50" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#FF9933] uppercase tracking-wide">
                <Star className="size-3.5 fill-[#FF9933]" />
                Cover Image
              </div>
              {cover ? (
                <>
                  <div className="text-sm font-medium text-[#1a1a3e] truncate mt-1">
                    {cover.caption ?? cover.file_name}
                  </div>
                  <div className="text-xs text-[#1a1a3e]/60">
                    {cover.photographer_name ? `By ${cover.photographer_name}` : "No photographer set"}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 text-xs"
                    onClick={() => handleSetCover(cover.id)}
                    disabled={pending}
                  >
                    <StarOff className="size-3 mr-1" />
                    Clear Cover
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-sm text-[#1a1a3e]/70 mt-1">
                    No cover image yet. Click the star icon on any photo below to set it as the cover.
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed transition-all p-8 text-center cursor-pointer ${
          isDragging
            ? "border-[#FF9933] bg-[#FF9933]/5"
            : "border-[#1a1a3e]/15 bg-[#FEFCF6] hover:border-[#FF9933]/50 hover:bg-[#FF9933]/5"
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <Camera className="size-8 mx-auto text-[#FF9933]" />
        <div className="mt-3 text-sm font-medium text-[#1a1a3e]">
          Drag &amp; drop photos, videos, or documents here
        </div>
        <div className="text-xs text-[#1a1a3e]/60 mt-1">
          or click to browse &middot; uploads run {PARALLEL_UPLOADS} at a time
        </div>
      </div>

      {/* Upload progress list */}
      {uploads.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-[#1a1a3e]">
                Uploads {activeUploads > 0 ? `(${activeUploads} in progress)` : "(all done)"}
              </div>
              {activeUploads === 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setUploads([])}
                  className="text-xs"
                >
                  Clear list
                </Button>
              )}
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {uploads.map((u) => (
                <div key={u.id} className="flex items-center gap-3 text-xs">
                  <div className="w-48 truncate text-[#1a1a3e]">{u.file.name}</div>
                  <div className="flex-1 h-1.5 bg-[#1a1a3e]/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        u.status === "error"
                          ? "bg-red-500"
                          : u.status === "done"
                          ? "bg-[#138808]"
                          : "bg-[#FF9933]"
                      }`}
                      style={{ width: `${u.progress}%` }}
                    />
                  </div>
                  <div className="w-20 text-right text-[#1a1a3e]/60">
                    {u.status === "error"
                      ? "Error"
                      : u.status === "done"
                      ? "Done"
                      : u.status === "uploading"
                      ? `${u.progress}%`
                      : "Queued"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1 flex-wrap">
          <FilterChip
            active={kindFilter === "all"}
            onClick={() => setKindFilter("all")}
            label={`All (${stats.total})`}
          />
          <FilterChip
            active={kindFilter === "photo"}
            onClick={() => setKindFilter("photo")}
            label={`Photos (${stats.photos})`}
          />
          <FilterChip
            active={kindFilter === "video"}
            onClick={() => setKindFilter("video")}
            label={`Videos (${stats.videos})`}
          />
          <FilterChip
            active={kindFilter === "document"}
            onClick={() => setKindFilter("document")}
            label={`Docs (${stats.documents})`}
          />
        </div>
        <span className="text-[#1a1a3e]/20">|</span>
        <select
          value={visFilter}
          onChange={(e) => setVisFilter(e.target.value as MediaVisibility | "all")}
          className="text-xs border border-[#1a1a3e]/15 rounded-md px-2 py-1.5 bg-white text-[#1a1a3e]/80"
        >
          <option value="all">All visibility</option>
          <option value="public">Public</option>
          <option value="yi_internal">Yi Internal</option>
          <option value="organizer_only">Organizer Only</option>
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#1a1a3e]/40" />
          <Input
            placeholder="Search caption, photographer, tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Button
          variant={selectionMode ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setSelectionMode((m) => !m);
            if (selectionMode) setSelection(new Set());
          }}
          className={selectionMode ? "bg-[#1a1a3e] hover:bg-[#1a1a3e]/90 text-white" : ""}
        >
          {selectionMode ? (
            <>
              <CheckSquare className="size-4 mr-1" /> Selecting
            </>
          ) : (
            <>
              <Square className="size-4 mr-1" /> Select
            </>
          )}
        </Button>
      </div>

      {/* Bulk action bar */}
      {selectionMode && selection.size > 0 && (
        <div className="sticky top-0 z-10 rounded-lg bg-[#1a1a3e] text-white px-4 py-2.5 flex items-center gap-3 shadow-lg">
          <span className="text-sm font-medium">
            {selection.size} selected
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={selectAll}
            className="text-white hover:bg-white/10 h-7 text-xs"
          >
            Select all visible
          </Button>
          <div className="h-5 w-px bg-white/20 mx-1" />
          <span className="text-xs text-white/70">Set visibility:</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulkVisibility("public")}
            className="h-7 text-xs bg-transparent border-white/30 text-white hover:bg-white/10"
            disabled={pending}
          >
            <Eye className="size-3 mr-1" /> Public
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulkVisibility("yi_internal")}
            className="h-7 text-xs bg-transparent border-white/30 text-white hover:bg-white/10"
            disabled={pending}
          >
            <UsersIcon className="size-3 mr-1" /> Yi Internal
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulkVisibility("organizer_only")}
            className="h-7 text-xs bg-transparent border-white/30 text-white hover:bg-white/10"
            disabled={pending}
          >
            <Lock className="size-3 mr-1" /> Organizer
          </Button>
          <div className="h-5 w-px bg-white/20 mx-1" />
          <Button
            size="sm"
            variant="outline"
            onClick={handleBulkDelete}
            className="h-7 text-xs bg-transparent border-red-300/60 text-red-200 hover:bg-red-500/20"
            disabled={pending}
          >
            <Trash2 className="size-3 mr-1" /> Delete
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={clearSelection}
            className="text-white hover:bg-white/10 h-7 text-xs ml-auto"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Images className="size-10 mx-auto text-[#1a1a3e]/20" />
            <div className="mt-3 text-sm text-[#1a1a3e]/50">
              {media.length === 0
                ? "No media uploaded yet. Drop files above to get started."
                : "No files match the current filters."}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((m) => (
            <MediaCard
              key={m.id}
              media={m}
              selected={selection.has(m.id)}
              selectionMode={selectionMode}
              isEditing={editingId === m.id}
              editDraft={editDraft}
              setEditDraft={setEditDraft}
              onToggleSelect={() => toggleSelect(m.id)}
              onStartEdit={() => startEdit(m)}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={saveEdit}
              onSetCover={() => handleSetCover(m.id)}
              onDelete={() => handleDeleteOne(m.id)}
              onSetVisibility={(v) => handleSetVisibility(m.id, v)}
              pending={pending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────

function MediaCard({
  media,
  selected,
  selectionMode,
  isEditing,
  editDraft,
  setEditDraft,
  onToggleSelect,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onSetCover,
  onDelete,
  onSetVisibility,
  pending,
}: {
  media: EventMedia;
  selected: boolean;
  selectionMode: boolean;
  isEditing: boolean;
  editDraft: { caption: string; photographer_name: string };
  setEditDraft: (d: { caption: string; photographer_name: string }) => void;
  onToggleSelect: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onSetCover: () => void;
  onDelete: () => void;
  onSetVisibility: (v: MediaVisibility) => void;
  pending: boolean;
}) {
  const KindIcon =
    media.kind === "photo" ? ImageIcon : media.kind === "video" ? Film : FileText;

  return (
    <div
      className={`group rounded-xl overflow-hidden bg-white border transition-all ${
        selected
          ? "border-[#FF9933] ring-2 ring-[#FF9933]/30"
          : "border-[#1a1a3e]/10 hover:border-[#1a1a3e]/25 hover:shadow-md"
      }`}
    >
      {/* Thumbnail */}
      <div
        className="relative aspect-[4/3] bg-[#FEFCF6] flex items-center justify-center cursor-pointer"
        onClick={() => {
          if (selectionMode) onToggleSelect();
          else if (media.public_url) window.open(media.public_url, "_blank");
        }}
      >
        {media.kind === "photo" && media.public_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.public_url}
            alt={media.caption ?? media.file_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : media.kind === "video" && media.public_url ? (
          <div className="relative w-full h-full">
            <video
              src={media.public_url}
              className="w-full h-full object-cover"
              preload="metadata"
              muted
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Film className="size-10 text-white drop-shadow" />
            </div>
          </div>
        ) : (
          <KindIcon className="size-12 text-[#1a1a3e]/30" />
        )}

        {/* Selection checkbox */}
        {selectionMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className={`absolute top-2 left-2 size-6 rounded-md flex items-center justify-center transition-all ${
              selected
                ? "bg-[#FF9933] text-white"
                : "bg-white/90 border border-[#1a1a3e]/20 text-transparent hover:text-[#1a1a3e]/30"
            }`}
          >
            <CheckSquare className="size-4" />
          </button>
        )}

        {/* Cover badge */}
        {media.is_cover && (
          <div className="absolute top-2 right-2 bg-[#FF9933] text-white rounded-full px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
            <Star className="size-3 fill-white" /> Cover
          </div>
        )}

        {/* Kind pill (bottom-left) */}
        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide flex items-center gap-1">
          <KindIcon className="size-3" />
          {media.kind}
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-1.5">
        {isEditing ? (
          <>
            <Input
              value={editDraft.caption}
              onChange={(e) =>
                setEditDraft({ ...editDraft, caption: e.target.value })
              }
              placeholder="Caption…"
              className="h-8 text-xs"
            />
            <Input
              value={editDraft.photographer_name}
              onChange={(e) =>
                setEditDraft({ ...editDraft, photographer_name: e.target.value })
              }
              placeholder="Photographer name"
              className="h-8 text-xs"
            />
            <div className="flex gap-1 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={onCancelEdit}
                className="h-7 text-xs"
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={onSaveEdit}
                className="h-7 text-xs bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
                disabled={pending}
              >
                {pending && <Loader2 className="size-3 mr-1 animate-spin" />}
                Save
              </Button>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={onStartEdit}
              className="w-full text-left text-xs font-medium text-[#1a1a3e] line-clamp-2 hover:text-[#FF9933] transition-colors min-h-[2rem]"
            >
              {media.caption || (
                <span className="italic text-[#1a1a3e]/40">Click to add caption…</span>
              )}
            </button>
            <div className="text-[10px] text-[#1a1a3e]/60 truncate">
              {media.photographer_name ? (
                <>By {media.photographer_name}</>
              ) : (
                <span className="italic">No photographer</span>
              )}
              {" · "}
              {formatBytes(media.size_bytes)}
            </div>

            {/* Visibility */}
            <div className="flex items-center gap-1 flex-wrap pt-1">
              <select
                value={media.visibility}
                onChange={(e) => onSetVisibility(e.target.value as MediaVisibility)}
                disabled={pending}
                title={MEDIA_VISIBILITY_DESCRIPTIONS[media.visibility]}
                className={`text-[10px] rounded px-1.5 py-0.5 border ${
                  MEDIA_VISIBILITY_COLORS[media.visibility]
                }`}
              >
                <option value="public">Public</option>
                <option value="yi_internal">Yi Internal</option>
                <option value="organizer_only">Organizer Only</option>
              </select>
            </div>

            {/* Action row */}
            <div className="flex items-center gap-1 pt-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={onSetCover}
                className="size-7"
                title={media.is_cover ? "Clear cover" : "Set as cover"}
                disabled={pending || media.kind !== "photo"}
              >
                <Star
                  className={`size-3.5 ${
                    media.is_cover
                      ? "fill-[#FF9933] text-[#FF9933]"
                      : "text-[#1a1a3e]/40"
                  }`}
                />
              </Button>
              {media.public_url && (
                <a
                  href={media.public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={media.file_name}
                  onClick={(e) => e.stopPropagation()}
                  className="size-7 inline-flex items-center justify-center rounded-md hover:bg-[#1a1a3e]/5 text-[#1a1a3e]/60"
                  title="Download"
                >
                  <Download className="size-3.5" />
                </a>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={onDelete}
                className="size-7 text-red-600 hover:bg-red-50 ml-auto"
                title="Delete"
                disabled={pending}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sub?: string;
  color: "green" | "orange" | "indigo" | "blue";
}) {
  const map = {
    green: { bg: "bg-[#138808]/10", text: "text-[#138808]" },
    orange: { bg: "bg-[#FF9933]/10", text: "text-[#FF9933]" },
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600" },
    blue: { bg: "bg-blue-50", text: "text-blue-600" },
  }[color];
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-3">
          <div
            className={`size-9 rounded-lg ${map.bg} flex items-center justify-center`}
          >
            <Icon className={`size-5 ${map.text}`} />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold text-[#1a1a3e] truncate">{value}</div>
            <div className="text-xs text-[#1a1a3e]/60">{label}</div>
            {sub && <div className="text-[10px] text-[#1a1a3e]/40 truncate">{sub}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
        active
          ? "bg-[#1a1a3e] text-white border-[#1a1a3e]"
          : "bg-white text-[#1a1a3e]/70 border-[#1a1a3e]/10 hover:border-[#1a1a3e]/30"
      }`}
    >
      {label}
    </button>
  );
}

// Read an image file's intrinsic dimensions via an object URL.
function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };
    img.src = url;
  });
}

// Keep MEDIA_KINDS referenced so TS doesn't flag the import as unused when
// kind-filter UI changes later — explicit side-effect-free touch.
void MEDIA_KINDS;
