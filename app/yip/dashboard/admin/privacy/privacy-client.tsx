"use client";

import { useMemo, useState, useTransition } from "react";
import { Switch } from "@/components/yip/ui/switch";
import { Input } from "@/components/yip/ui/input";
import { Lock } from "lucide-react";
import {
  setChapterPrivacyDefault,
  type ChapterPrivacyRow,
} from "@/app/yip/actions/pii";

/**
 * Admin → Data Privacy (DPDP). Per-chapter standing privacy default. When a
 * chapter is ON, its NEW events are created in privacy mode: student personal
 * data is masked from non-organisers during the event and permanently
 * anonymized after results publish. Existing events are unaffected — clean
 * those with the People admin's "Remove personal data" tool.
 */
export function PrivacyAdminClient({
  initialChapters,
}: {
  initialChapters: ChapterPrivacyRow[];
}) {
  const [chapters, setChapters] = useState(initialChapters);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  function toggle(yiChapter: string, next: boolean) {
    setError(null);
    // Optimistic; revert on failure.
    setChapters((cs) =>
      cs.map((c) =>
        c.yi_chapter === yiChapter ? { ...c, privacy_default: next } : c
      )
    );
    startTransition(async () => {
      const res = await setChapterPrivacyDefault(yiChapter, next);
      if (!res.success) {
        setError(res.error);
        setChapters((cs) =>
          cs.map((c) =>
            c.yi_chapter === yiChapter ? { ...c, privacy_default: !next } : c
          )
        );
      }
    });
  }

  const filtered = useMemo(
    () =>
      chapters.filter((c) =>
        c.yi_chapter.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [chapters, query]
  );
  const onCount = chapters.filter((c) => c.privacy_default).length;

  return (
    <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1a1a3e] flex items-center gap-2">
          <Lock className="size-7 text-[#FF9933]" /> Data Privacy (DPDP)
        </h1>
        <p className="text-sm text-[#1a1a3e]/60 mt-1 max-w-2xl">
          Every chapter is <strong>ON by default</strong> (privacy by default).
          When a chapter is ON, its <strong>new</strong> events run in privacy
          mode — student personal data (name / email / phone / school) is hidden
          from jury, projector and students during the event, and permanently
          anonymized after results publish. Toggle a chapter <strong>off</strong>{" "}
          to collect full details for that chapter’s future events. Existing
          events are unaffected; clean those from People → “Remove personal
          data”. {onCount} of {chapters.length} chapters on.
        </p>
      </div>

      <Input
        placeholder="Search chapters…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      {error && <p className="text-sm text-[#cc3a21]">{error}</p>}

      {filtered.length === 0 ? (
        <p className="text-sm text-[#1a1a3e]/50 py-8">No chapters match.</p>
      ) : (
        <div className="divide-y divide-[#1a1a3e]/10 rounded-lg border border-[#1a1a3e]/15">
          {filtered.map((c) => (
            <div
              key={c.yi_chapter}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <span className="text-sm font-medium text-[#1a1a3e]">
                {c.yi_chapter}
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={
                    c.privacy_default
                      ? "text-xs font-semibold text-[#138808]"
                      : "text-xs text-[#1a1a3e]/40"
                  }
                >
                  {c.privacy_default ? "Privacy ON" : "Standard"}
                </span>
                <Switch
                  checked={c.privacy_default}
                  disabled={pending}
                  onCheckedChange={(v) => toggle(c.yi_chapter, v)}
                  aria-label={`Privacy mode for ${c.yi_chapter}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
