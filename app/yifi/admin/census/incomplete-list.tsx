"use client";

import { useMemo, useState } from "react";
import { WhatsAppIconButton } from "@/components/whatsapp";

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

// Normalize an Indian mobile number to a country-code-prefixed digit string.
function waPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return null;
  return digits.startsWith("91") ? digits : "91" + digits;
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
            const phone = person.phone ? waPhone(person.phone) : null;
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
                {phone ? (
                  <div className="shrink-0">
                    <WhatsAppIconButton
                      contact={{
                        phone,
                        name: person.full_name ?? undefined,
                      }}
                      defaultMessage={`Hi ${firstName(
                        person.full_name
                      )}, please complete your YiFi Madurai 2026 census so we can match you to the right people. Thanks!`}
                    />
                  </div>
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
