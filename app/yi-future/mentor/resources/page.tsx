"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/yi-future/supabase/client";
import {
  addResource,
  deleteResource,
  listMyResources,
  type ResourceRow,
} from "@/app/yi-future/actions/resources";

const BUCKET = "future-resources";

function formatRelative(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const diffMs = Date.now() - then;
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.substring(0, 10);
  }
}

export default function MentorResourcesPage() {
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<"file" | "url">("file");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function refresh() {
    setLoading(true);
    const rows = await listMyResources();
    setResources(rows);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    if (type === "file") {
      if (!file) {
        setError("Pick a file to upload.");
        return;
      }
      setUploading(true);
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        // Mentors don't have a Supabase Auth session; they use access codes.
        // The bucket is public for upload? No — we use the client without auth
        // and rely on the public bucket setting. If anonymous upload is
        // disabled, the server action will reject.
        // For simplicity: derive a stable mentor-id-ish key from current time.
        // The access-code session cookie is httpOnly so we can't read mentor_id
        // directly; we use a timestamp-based folder. Server action records the
        // path so deletion still works.
        const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
        const path = `uploads/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { upsert: false });
        if (upErr) {
          setError(`Upload failed: ${upErr.message}`);
          setUploading(false);
          return;
        }

        const result = await addResource({
          title: title.trim(),
          description: description.trim() || undefined,
          type: "file",
          filePath: path,
        });
        if (!result.ok) {
          setError(result.error);
          setUploading(false);
          return;
        }
        setSuccess(result.message ?? "Resource added.");
        setTitle("");
        setDescription("");
        setFile(null);
        // Reset the file input by remounting via key — simplest: clear by id.
        const input = document.getElementById(
          "resource-file"
        ) as HTMLInputElement | null;
        if (input) input.value = "";
        startTransition(() => {
          refresh();
        });
        // Suppress unused-var lint for `session`.
        void session;
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setUploading(false);
      }
    } else {
      const result = await addResource({
        title: title.trim(),
        description: description.trim() || undefined,
        type: "url",
        externalUrl: externalUrl.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(result.message ?? "Resource added.");
      setTitle("");
      setDescription("");
      setExternalUrl("");
      startTransition(() => {
        refresh();
      });
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this resource?")) return;
    const result = await deleteResource(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess(result.message ?? "Deleted.");
    startTransition(() => {
      refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Study Resources</h1>
        <p className="mt-1 text-sm text-navy/60">
          Upload reading lists, decks, video links, or templates. Every team in
          this edition can read them.
        </p>
      </div>

      {/* Upload form */}
      <section className="bg-white border border-navy/10 rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-navy/70">
          Add a resource
        </h2>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-navy/70 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm focus:outline-none focus:border-yi-gold"
              placeholder="e.g. Policy brief framework — 1-pager"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-navy/70 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm focus:outline-none focus:border-yi-gold"
              placeholder="What's inside, and how should the team use it?"
            />
          </div>

          <div>
            <div className="block text-xs font-semibold text-navy/70 mb-2">
              Type
            </div>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="resource-type"
                  value="file"
                  checked={type === "file"}
                  onChange={() => setType("file")}
                />
                <span className="text-sm">📄 File upload</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="resource-type"
                  value="url"
                  checked={type === "url"}
                  onChange={() => setType("url")}
                />
                <span className="text-sm">🔗 External link</span>
              </label>
            </div>
          </div>

          {type === "file" ? (
            <div>
              <label className="block text-xs font-semibold text-navy/70 mb-1">
                File *
              </label>
              <input
                id="resource-file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-navy file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-navy file:text-ivory file:text-xs file:font-semibold hover:file:bg-navy-dark"
              />
              {file && (
                <p className="mt-1 text-xs text-navy/50">
                  {file.name} · {(file.size / 1024).toFixed(0)} KB
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-navy/70 mb-1">
                URL *
              </label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                required
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm font-mono focus:outline-none focus:border-yi-gold"
                placeholder="https://docs.google.com/..."
              />
            </div>
          )}

          {error && (
            <div className="text-sm text-yi-saffron bg-yi-saffron/5 border border-yi-saffron/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          {success && !error && (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || pending}
            className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading…" : "Add resource"}
          </button>
        </form>
      </section>

      {/* My resources */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-navy/70">
          My resources ({resources.length})
        </h2>
        {loading ? (
          <div className="bg-white border border-navy/10 rounded-lg p-6 text-center text-sm text-navy/50">
            Loading…
          </div>
        ) : resources.length === 0 ? (
          <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
            <div className="text-3xl mb-2">📚</div>
            <p className="text-sm text-navy/60">
              You haven&apos;t shared anything yet.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {resources.map((r) => (
              <li
                key={r.id}
                className="bg-white border border-navy/10 rounded-lg p-4 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true">
                      {r.resource_type === "file" ? "📄" : "🔗"}
                    </span>
                    <span className="font-semibold text-navy">{r.title}</span>
                  </div>
                  {r.description && (
                    <p className="mt-1 text-sm text-navy/70">{r.description}</p>
                  )}
                  <p className="mt-1 text-xs text-navy/40">
                    {formatRelative(r.created_at)}
                  </p>
                  {r.resource_type === "url" && r.external_url && (
                    <p className="mt-1 text-xs text-navy/50 font-mono break-all">
                      {r.external_url}
                    </p>
                  )}
                  {r.resource_type === "file" && r.file_path && (
                    <p className="mt-1 text-xs text-navy/50 font-mono break-all">
                      {r.file_path}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onDelete(r.id)}
                  className="px-2 py-1 text-xs font-semibold text-yi-saffron border border-yi-saffron/30 rounded hover:bg-yi-saffron/5"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
