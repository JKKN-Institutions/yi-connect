"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createVow } from "@/app/yifi/actions/vows";

interface Vow {
  id: string;
  category: string;
  vow_text: string;
  witness_id: string | null;
  status: string;
  tile_engraved: boolean;
  tile_placed: boolean;
}

interface VowSectionProps {
  registrantId: string;
  editionId: string;
  vows: Vow[];
}

const VOW_CATEGORIES = [
  { key: "business", label: "Business", emoji: "💼", placeholder: "I commit to..." },
  { key: "family_health", label: "Family & Health", emoji: "❤️", placeholder: "For my family, I will..." },
  { key: "yi", label: "Yi / Nation Building", emoji: "🇮🇳", placeholder: "For India, I will..." },
] as const;

export function VowSection({ registrantId, editionId, vows }: VowSectionProps) {
  const vowMap = new Map(vows.map((v) => [v.category, v]));

  return (
    <div className="space-y-3">
      {VOW_CATEGORIES.map((cat) => {
        const existing = vowMap.get(cat.key);
        return existing ? (
          <VowCard key={cat.key} vow={existing} category={cat} />
        ) : (
          <VowInput
            key={cat.key}
            category={cat}
            registrantId={registrantId}
            editionId={editionId}
          />
        );
      })}
    </div>
  );
}

function VowCard({
  vow,
  category,
}: {
  vow: Vow;
  category: (typeof VOW_CATEGORIES)[number];
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span>{category.emoji}</span>
        <span className="text-white/60 text-xs uppercase tracking-wide">
          {category.label}
        </span>
        {vow.tile_placed && (
          <span className="ml-auto text-[#229434] text-xs">🪨 Placed</span>
        )}
        {vow.tile_engraved && !vow.tile_placed && (
          <span className="ml-auto text-white/40 text-xs">Engraved</span>
        )}
      </div>
      <p className="text-white text-sm font-medium">&ldquo;{vow.vow_text}&rdquo;</p>
      <div className="flex items-center justify-between mt-2">
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
      </div>
    </div>
  );
}

function VowInput({
  category,
  registrantId,
  editionId,
}: {
  category: (typeof VOW_CATEGORIES)[number];
  registrantId: string;
  editionId: string;
}) {
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setError("");

    startTransition(async () => {
      const result = await createVow({
        registrantId,
        editionId,
        category: category.key,
        vowText: text.trim(),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white/5 border border-dashed border-white/20 rounded-xl p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <span>{category.emoji}</span>
        <span className="text-white/60 text-xs uppercase tracking-wide">
          {category.label}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={category.placeholder}
          maxLength={100}
          className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/30 focus:ring-2 focus:ring-[#FD7215] focus:border-transparent"
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={isPending || !text.trim()}
          className="px-4 py-2 bg-[#FD7215] text-white text-sm font-medium rounded-lg hover:bg-[#e5660f] disabled:opacity-50 transition-colors"
        >
          {isPending ? "..." : "Vow"}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </form>
  );
}
