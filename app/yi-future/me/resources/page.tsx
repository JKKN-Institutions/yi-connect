"use client";

import { useEffect, useState } from "react";
import {
  getResourceSignedUrl,
  listResources,
  type ResourceRow,
} from "@/app/yi-future/actions/resources";

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

export default function DelegateResourcesPage() {
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listResources();
        if (!cancelled) {
          setResources(rows);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function openFile(filePath: string) {
    const result = await getResourceSignedUrl(filePath);
    if (!result.url) {
      alert(result.error ?? "Could not open file.");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Study Resources</h1>
        <p className="mt-1 text-sm text-navy/60">
          Reading material, decks, and links shared by mentors across this
          edition.
        </p>
      </div>

      {error && (
        <div className="text-sm text-yi-saffron bg-yi-saffron/5 border border-yi-saffron/20 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-navy/10 rounded-lg p-6 text-center text-sm text-navy/50">
          Loading…
        </div>
      ) : resources.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center">
          <div className="text-4xl mb-2">📚</div>
          <h2 className="text-lg font-bold text-navy">Nothing shared yet</h2>
          <p className="mt-2 text-sm text-navy/60">
            Mentors will post study material here as the journey progresses.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {resources.map((r) => (
            <li
              key={r.id}
              className="bg-white border border-navy/10 rounded-lg p-5"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="text-lg"
                      title={
                        r.resource_type === "file" ? "File" : "External link"
                      }
                    >
                      {r.resource_type === "file" ? "📄" : "🔗"}
                    </span>
                    <h3 className="font-bold text-navy">{r.title}</h3>
                  </div>
                  {r.description && (
                    <p className="mt-2 text-sm text-navy/80 whitespace-pre-wrap">
                      {r.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-navy/50">
                    Shared by{" "}
                    <span className="font-semibold">
                      {r.mentors?.full_name ?? "Mentor"}
                    </span>
                    {r.mentors?.organization && (
                      <span className="text-navy/40">
                        {" · "}
                        {r.mentors.organization}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-navy/40">
                    {formatRelative(r.created_at)}
                  </p>
                </div>

                {r.resource_type === "file" && r.file_path ? (
                  <button
                    onClick={() => openFile(r.file_path as string)}
                    className="px-3 py-1.5 rounded-md bg-navy text-ivory text-xs font-semibold hover:bg-navy-dark whitespace-nowrap"
                  >
                    Open
                  </button>
                ) : r.external_url ? (
                  <a
                    href={r.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-md bg-navy text-ivory text-xs font-semibold hover:bg-navy-dark whitespace-nowrap"
                  >
                    Open ↗
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
