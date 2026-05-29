"use client";

import { useMemo, useState } from "react";

interface IncompletePerson {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  organisation: string | null;
}

interface IncompleteListProps {
  items: IncompletePerson[];
}

function firstName(fullName: string | null): string {
  if (!fullName) return "there";
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

function buildWhatsAppLink(person: IncompletePerson): string | null {
  if (!person.phone) return null;
  const digits = person.phone.replace(/\D/g, "");
  if (!digits) return null;
  const message = `Hi ${firstName(
    person.full_name
  )}, please complete your YiFi Madurai 2026 census so we can match you to the right people. Thanks!`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function IncompleteList({ items }: IncompleteListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((person) => {
      const name = (person.full_name ?? "").toLowerCase();
      const org = (person.organisation ?? "").toLowerCase();
      return name.includes(q) || org.includes(q);
    });
  }, [items, query]);

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or organisation…"
        className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FD7215]/50"
      />

      {filtered.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
          <p className="text-white/40 text-sm">No matches for “{query}”.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((person) => {
            const waLink = buildWhatsAppLink(person);
            return (
              <div
                key={person.id}
                className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-white/20 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-white font-medium text-sm truncate">
                    {person.full_name || "Unnamed registrant"}
                  </p>
                  <p className="text-white/50 text-xs truncate">
                    {person.organisation || "—"}
                  </p>
                </div>
                {waLink ? (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-lg bg-[#229434]/20 text-[#229434] text-xs font-medium px-3 py-2 hover:bg-[#229434]/30 transition-colors whitespace-nowrap"
                  >
                    Nudge on WhatsApp
                  </a>
                ) : (
                  <span className="shrink-0 text-white/30 text-xs whitespace-nowrap">
                    No phone
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
