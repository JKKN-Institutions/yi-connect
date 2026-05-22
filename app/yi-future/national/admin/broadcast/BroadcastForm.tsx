"use client";

import { useState, useTransition } from "react";
import { broadcastPush } from "@/app/yi-future/actions/push";

type Result =
  | { kind: "idle" }
  | { kind: "ok"; sent: number; failed: number; removed: number }
  | { kind: "error"; message: string };

export function BroadcastForm(): React.JSX.Element {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/national/admin");
  const [result, setResult] = useState<Result>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult({ kind: "idle" });
    startTransition(async () => {
      const res = await broadcastPush(title, body, url, { kind: "all" });
      if (res.ok) {
        setResult({
          kind: "ok",
          sent: res.sent,
          failed: res.failed,
          removed: res.removed,
        });
        setTitle("");
        setBody("");
      } else {
        setResult({ kind: "error", message: res.error });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <div>
        <label
          htmlFor="b-title"
          className="block text-sm font-medium text-slate-700"
        >
          Title
        </label>
        <input
          id="b-title"
          type="text"
          required
          maxLength={80}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="e.g. Submission deadline extended"
        />
      </div>

      <div>
        <label
          htmlFor="b-body"
          className="block text-sm font-medium text-slate-700"
        >
          Body
        </label>
        <textarea
          id="b-body"
          required
          maxLength={300}
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Short message shown in the notification."
        />
      </div>

      <div>
        <label
          htmlFor="b-url"
          className="block text-sm font-medium text-slate-700"
        >
          Target URL
        </label>
        <input
          id="b-url"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="/national/admin"
        />
        <p className="mt-1 text-xs text-slate-500">
          Where clicking the notification will navigate. Defaults to{" "}
          <code>/national/admin</code>.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Audience
        </label>
        <p className="mt-1 text-sm text-slate-600">
          All subscribed admins (chapter/host/national).
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Chapter / role filters will be added in a later iteration.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !title.trim() || !body.trim()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send broadcast"}
        </button>

        {result.kind === "ok" ? (
          <p className="text-sm text-emerald-700">
            Sent: {result.sent} · Failed: {result.failed} · Pruned:{" "}
            {result.removed}
          </p>
        ) : null}
        {result.kind === "error" ? (
          <p className="text-sm text-red-700">{result.message}</p>
        ) : null}
      </div>
    </form>
  );
}
