// Shared Event Media constants + helpers (no "use server" — importable by
// both client and server components). Handbook p.10 + p.46.

export type MediaKind = "photo" | "video" | "document";
export type MediaVisibility = "public" | "yi_internal" | "organizer_only";

export type EventMedia = {
  id: string;
  event_id: string;
  kind: MediaKind;
  storage_path: string;
  public_url: string | null;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  photographer_name: string | null;
  tags: string[] | null;
  visibility: MediaVisibility;
  is_cover: boolean;
  taken_at: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

export const MEDIA_KINDS: { code: MediaKind; label: string; plural: string }[] = [
  { code: "photo", label: "Photo", plural: "Photos" },
  { code: "video", label: "Video", plural: "Videos" },
  { code: "document", label: "Document", plural: "Documents" },
];

export const MEDIA_VISIBILITY_LABELS: Record<MediaVisibility, string> = {
  public: "Public",
  yi_internal: "Yi Internal",
  organizer_only: "Organizer Only",
};

export const MEDIA_VISIBILITY_COLORS: Record<MediaVisibility, string> = {
  public: "bg-[#138808]/10 text-[#138808] border-[#138808]/20",
  yi_internal: "bg-[#FF9933]/10 text-[#FF9933] border-[#FF9933]/20",
  organizer_only: "bg-[#1a1a3e]/10 text-[#1a1a3e] border-[#1a1a3e]/20",
};

export const MEDIA_VISIBILITY_DESCRIPTIONS: Record<MediaVisibility, string> = {
  public: "Shared publicly — safe to post on social media and websites.",
  yi_internal: "Yi team + chapter organizers only — internal sharing.",
  organizer_only: "This event's organizers only — not for distribution.",
};

export const STORAGE_BUCKET = "event-media";

// Map a MIME type to our kind enum. Falls back to 'document'.
export function mimeToKind(mime: string | null | undefined): MediaKind {
  if (!mime) return "document";
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

// Human-friendly byte formatter: 1536 -> "1.5 KB", 2_500_000 -> "2.4 MB".
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

// Build a storage path for a freshly-uploaded file.
// Pattern: events/{eventId}/{photos|videos|documents}/{uuid}_{safeName}
export function buildStoragePath(
  eventId: string,
  kind: MediaKind,
  fileName: string
): string {
  const folder =
    kind === "photo" ? "photos" : kind === "video" ? "videos" : "documents";
  const safe = fileName
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 120);
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `events/${eventId}/${folder}/${uuid}_${safe || "file"}`;
}

export const MEDIA_ACCEPTED_MIME =
  "image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain";
