"use client";

import { useState } from "react";
import { Badge } from "@/components/yip/ui/badge";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Input } from "@/components/yip/ui/input";
import { Search, BookOpen, Globe, MapPin, ExternalLink } from "lucide-react";
import { YI_ZONES } from "@/lib/yip/hierarchy";
import type { Topic } from "@/app/actions/yip/topics";

type Filter = "all" | "central" | "ER" | "WR" | "NR" | "NER" | "SRTN" | "SRTKKA";

const ZONE_LABELS: Record<string, string> = Object.fromEntries(
  YI_ZONES.map((z) => [z.code, z.label])
);

export function TopicsClient({ initialTopics }: { initialTopics: Topic[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = initialTopics.filter((t) => {
    if (query) {
      const q = query.toLowerCase();
      const hit =
        t.title.toLowerCase().includes(q) ||
        t.sub_points.some((sp) => sp.toLowerCase().includes(q));
      if (!hit) return false;
    }
    if (filter === "all") return true;
    if (filter === "central") return t.category === "central";
    return t.zone === filter;
  });

  const central = initialTopics.filter((t) => t.category === "central").length;
  const regional = initialTopics.filter((t) => t.category === "regional").length;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#1a1a3e] tracking-tight flex items-center gap-2">
          <BookOpen className="size-7 text-[#FF9933]" />
          Topic Library
        </h1>
        <p className="text-sm text-[#1a1a3e]/60 mt-1">
          YIP 2026 Handbook pages 25–38 · {central} Central + {regional} Regional topics
        </p>
      </div>

      {/* External references — handbook p.25 */}
      <Card className="bg-gradient-to-br from-[#FF9933]/5 to-[#138808]/5 border-[#FF9933]/15">
        <CardContent className="pt-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#FF9933] mb-2">
            Reference Sources (Handbook p. 25)
          </p>
          <p className="text-sm text-[#1a1a3e]/70 mb-3">
            Members are requested to stay updated with current topics of discussions
            and deliberations happening in the country:
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://www.prsindia.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1a1a3e] hover:text-[#FF9933] underline decoration-dotted underline-offset-4"
            >
              prsindia.org <ExternalLink className="size-3" />
            </a>
            <a
              href="https://www.cprindia.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1a1a3e] hover:text-[#FF9933] underline decoration-dotted underline-offset-4"
            >
              cprindia.org <ExternalLink className="size-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#1a1a3e]/40" />
          <Input
            placeholder="Search topics, sub-points, keywords…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            All ({initialTopics.length})
          </FilterChip>
          <FilterChip
            active={filter === "central"}
            onClick={() => setFilter("central")}
            icon={<Globe className="size-3" />}
          >
            Central ({central})
          </FilterChip>
          {YI_ZONES.map((z) => {
            const n = initialTopics.filter((t) => t.zone === z.code).length;
            return (
              <FilterChip
                key={z.code}
                active={filter === z.code}
                onClick={() => setFilter(z.code)}
                icon={<MapPin className="size-3" />}
              >
                {z.label} ({n})
              </FilterChip>
            );
          })}
        </div>
      </div>

      {/* Topics grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-12 text-sm text-[#1a1a3e]/50">
            No topics match your filters.
          </div>
        )}
        {filtered.map((t) => (
          <Card key={t.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-[#1a1a3e] leading-snug">
                  {t.topic_number && (
                    <span className="text-[#1a1a3e]/40 font-mono mr-2">
                      #{t.topic_number}
                    </span>
                  )}
                  {t.title}
                </h3>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {t.category === "central" ? (
                    <Badge className="bg-[#FF9933]/10 text-[#FF9933] border-[#FF9933]/20 text-[10px]">
                      Central
                    </Badge>
                  ) : (
                    <Badge className="bg-[#138808]/10 text-[#138808] border-[#138808]/20 text-[10px]">
                      {t.zone && ZONE_LABELS[t.zone]}
                    </Badge>
                  )}
                  {t.handbook_page && (
                    <span className="text-[9px] text-[#1a1a3e]/40 font-mono">
                      p. {t.handbook_page}
                    </span>
                  )}
                </div>
              </div>

              {t.sub_points.length > 0 && (
                <ul className="text-xs text-[#1a1a3e]/75 space-y-1 pl-4 list-disc">
                  {t.sub_points.map((sp, i) => (
                    <li key={i}>{sp}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
        active
          ? "bg-[#1a1a3e] text-white border-[#1a1a3e]"
          : "bg-white text-[#1a1a3e]/70 border-[#1a1a3e]/10 hover:border-[#1a1a3e]/30"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
