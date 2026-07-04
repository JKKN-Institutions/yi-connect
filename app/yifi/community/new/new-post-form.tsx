"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PostType } from "@/lib/yifi/community/types";
import { createPost } from "../actions";

const TYPE_OPTIONS: { key: PostType; label: string; hint: string }[] = [
  { key: "challenge", label: "Challenge", hint: "Ask the room for help" },
  { key: "best_practice", label: "Best Practice", hint: "Share what worked" },
  { key: "industry", label: "Industry", hint: "A trend or signal to discuss" },
];

export function NewPostForm({ defaultSector }: { defaultSector: string | null }) {
  const [type, setType] = useState<PostType>("challenge");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError("");
    formData.set("post_type", type);
    startTransition(async () => {
      const result = await createPost(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.id) {
        router.push(`/yifi/community/${result.id}`);
      } else {
        router.push("/yifi/community");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {/* Type selector */}
      <div>
        <label className="text-white/60 text-xs uppercase tracking-wide mb-2 block">
          Post type
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {TYPE_OPTIONS.map((opt) => {
            const active = type === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setType(opt.key)}
                className={`text-left rounded-xl border p-3 transition-colors ${
                  active
                    ? "bg-[#FD7215]/15 border-[#FD7215]/50"
                    : "bg-white/5 border-white/15 hover:border-white/30"
                }`}
              >
                <span
                  className={`block text-sm font-medium ${active ? "text-white" : "text-white/80"}`}
                >
                  {opt.label}
                </span>
                <span className="block text-[11px] text-white/40 mt-0.5">
                  {opt.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="title" className="text-white/60 text-xs uppercase tracking-wide mb-2 block">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={140}
          placeholder="One line — what's this about?"
          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/30 focus:ring-2 focus:ring-[#FD7215] focus:border-transparent"
          disabled={isPending}
        />
      </div>

      <div>
        <label htmlFor="body" className="text-white/60 text-xs uppercase tracking-wide mb-2 block">
          Details
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={6}
          placeholder="Give enough context for someone to reply usefully."
          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/30 focus:ring-2 focus:ring-[#FD7215] focus:border-transparent resize-y"
          disabled={isPending}
        />
      </div>

      <div>
        <label htmlFor="sector" className="text-white/60 text-xs uppercase tracking-wide mb-2 block">
          Sector (optional)
        </label>
        <input
          id="sector"
          name="sector"
          defaultValue={defaultSector ?? ""}
          maxLength={80}
          placeholder="e.g. SaaS, Manufacturing, Retail"
          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/30 focus:ring-2 focus:ring-[#FD7215] focus:border-transparent"
          disabled={isPending}
        />
      </div>

      <label className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 cursor-pointer">
        <input
          type="checkbox"
          name="is_anonymous"
          className="w-4 h-4 accent-[#FD7215]"
          disabled={isPending}
        />
        <span className="text-white/70 text-sm">
          Post anonymously
          <span className="block text-white/40 text-xs">
            Your name is hidden from other members (organisers can still see it).
          </span>
        </span>
      </label>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3 bg-[#FD7215] text-white font-semibold rounded-lg hover:bg-[#e5660f] transition-colors disabled:opacity-50"
      >
        {isPending ? "Publishing..." : "Publish post"}
      </button>
    </form>
  );
}
