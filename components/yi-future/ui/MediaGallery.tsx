"use client";

/**
 * MediaGallery — multi-image uploader backed by Supabase Storage.
 *
 * Usage:
 *   <MediaGallery
 *     bucketName="future-media"
 *     pathPrefix={`events/${eventId}`}
 *     initialPaths={report?.media_gallery_paths ?? []}
 *     onChange={(paths) => setGalleryPaths(paths)}
 *     maxImages={12}
 *     disabled={submitted}
 *   />
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/yi-future/supabase/client";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface MediaGalleryProps {
  bucketName: string;
  pathPrefix: string;
  initialPaths: string[];
  onChange: (paths: string[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

type UploadStatus = "pending" | "uploading" | "done" | "error";

interface ImageEntry {
  /** Storage path, e.g. "events/abc-123/1234567890-0-photo.jpg" */
  path: string;
  /** Signed URL for thumbnail preview (1-hour validity) */
  signedUrl: string | null;
  status: UploadStatus;
  error?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Replace chars outside [a-zA-Z0-9._-] with underscores */
function safeName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function getSignedUrl(
  bucket: string,
  path: string
): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600); // 1-hour validity
  if (error || !data) return null;
  return data.signedUrl;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function MediaGallery({
  bucketName,
  pathPrefix,
  initialPaths,
  onChange,
  maxImages = 12,
  disabled = false,
}: MediaGalleryProps): React.JSX.Element {
  const [entries, setEntries] = useState<ImageEntry[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bucketInitialised = useRef(false);

  // ── Bootstrap: ensure bucket exists + resolve signed URLs for initial paths
  useEffect(() => {
    if (bucketInitialised.current) return;
    bucketInitialised.current = true;

    const supabase = createClient();

    // Best-effort bucket creation — swallow "already exists" errors
    supabase.storage
      .createBucket(bucketName, { public: true })
      .catch(() => undefined);

    if (initialPaths.length === 0) return;

    // Resolve signed URLs for pre-existing paths
    Promise.all(
      initialPaths.map(async (path): Promise<ImageEntry> => {
        const signedUrl = await getSignedUrl(bucketName, path);
        return { path, signedUrl, status: "done" };
      })
    ).then((resolved) => {
      setEntries(resolved);
    });
  }, [bucketName, initialPaths]);

  // Notify parent whenever entries change (only "done" paths)
  useEffect(() => {
    const donePaths = entries
      .filter((e) => e.status === "done")
      .map((e) => e.path);
    onChange(donePaths);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  // ── Upload logic
  const uploadFiles = useCallback(
    async (files: File[]) => {
      const currentDone = entries.filter((e) => e.status === "done").length;
      const currentUploading = entries.filter(
        (e) => e.status === "uploading"
      ).length;
      const slots = maxImages - currentDone - currentUploading;
      const toUpload = Array.from(files).slice(0, Math.max(0, slots));
      if (toUpload.length === 0) return;

      const supabase = createClient();
      const now = Date.now();

      // Insert placeholder entries so grid shows spinners immediately
      const placeholders: ImageEntry[] = toUpload.map((f, i) => ({
        path: `${pathPrefix}/${now}-${i}-${safeName(f.name)}`,
        signedUrl: null,
        status: "uploading",
      }));

      setEntries((prev) => [...prev, ...placeholders]);

      // Upload in parallel
      await Promise.all(
        toUpload.map(async (file, i) => {
          const path = placeholders[i].path;
          const { error } = await supabase.storage
            .from(bucketName)
            .upload(path, file, { upsert: false });

          if (error) {
            setEntries((prev) =>
              prev.map((e) =>
                e.path === path
                  ? { ...e, status: "error", error: error.message }
                  : e
              )
            );
            return;
          }

          const signedUrl = await getSignedUrl(bucketName, path);
          setEntries((prev) =>
            prev.map((e) =>
              e.path === path ? { ...e, status: "done", signedUrl } : e
            )
          );
        })
      );
    },
    [bucketName, entries, maxImages, pathPrefix]
  );

  // ── Remove
  const removeEntry = useCallback(
    async (path: string) => {
      const supabase = createClient();
      // best-effort removal from storage
      await supabase.storage.from(bucketName).remove([path]).catch(() => null);
      setEntries((prev) => prev.filter((e) => e.path !== path));
    },
    [bucketName]
  );

  // ── File input change
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      uploadFiles(Array.from(e.target.files));
      // reset so same file can be re-added after removal
      e.target.value = "";
    },
    [uploadFiles]
  );

  // ── Drag & drop
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      setIsDragOver(true);
    },
    [disabled]
  );
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length > 0) uploadFiles(files);
    },
    [disabled, uploadFiles]
  );

  const donePaths = entries.filter((e) => e.status === "done").length;
  const totalCount = entries.length;
  const atMax = donePaths >= maxImages;

  return (
    <div className="space-y-3">
      {/* Counter */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-navy/50 tabular-nums">
          {donePaths} / {maxImages} images
        </span>
        {!disabled && !atMax && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[44px] px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy/90 transition-colors"
            aria-label="Add images"
          >
            + Add images
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={handleFileChange}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Drop zone + grid */}
      <div
        role="region"
        aria-label="Media gallery drop zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          "min-h-[120px] rounded-lg border-2 border-dashed p-3 transition-colors",
          isDragOver
            ? "border-yi-gold bg-yi-gold/5"
            : "border-navy/20 bg-navy/[0.02]",
          disabled ? "opacity-60 pointer-events-none" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-20 gap-2 text-navy/40 select-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <span className="text-xs">
              {disabled
                ? "No images uploaded."
                : "Drag images here or click \"Add images\""}
            </span>
          </div>
        ) : (
          <ul
            className="grid grid-cols-3 sm:grid-cols-4 gap-2"
            role="list"
            aria-label="Uploaded images"
          >
            {entries.map((entry) => (
              <li key={entry.path} className="relative aspect-square">
                {/* Thumbnail */}
                {entry.status === "done" && entry.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.signedUrl}
                    alt={entry.path.split("/").pop() ?? "image"}
                    className="w-full h-full object-cover rounded-md bg-navy/10"
                  />
                ) : (
                  <div className="w-full h-full rounded-md bg-navy/10 flex items-center justify-center">
                    {entry.status === "uploading" && (
                      <svg
                        className="w-6 h-6 animate-spin text-navy/40"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-label="Uploading"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        />
                      </svg>
                    )}
                    {entry.status === "error" && (
                      <span
                        className="text-[10px] text-red-500 text-center px-1 leading-tight"
                        title={entry.error}
                      >
                        Upload failed
                      </span>
                    )}
                    {entry.status === "pending" && (
                      <span className="text-[10px] text-navy/40">Waiting…</span>
                    )}
                  </div>
                )}

                {/* Remove button — only on done/error, not while uploading */}
                {!disabled && entry.status !== "uploading" && (
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.path)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-bold hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-600"
                    aria-label={`Remove ${entry.path.split("/").pop()}`}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!disabled && (
        <p className="text-[11px] text-navy/40">
          PNG, JPG, WEBP · max {maxImages} images · drag &amp; drop or click
          &quot;Add images&quot; above
        </p>
      )}
    </div>
  );
}
