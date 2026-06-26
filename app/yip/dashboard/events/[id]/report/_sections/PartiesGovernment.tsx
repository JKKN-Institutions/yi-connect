/**
 * YIP Chapter Round Report — Section 4: Parties & Government.
 *
 * Self-fetching server component (component contract). Mirrors the Overview
 * reference:
 *   - default-exported async server component (no "use client" here;
 *     interactivity lives in the PartySymbolFill child).
 *   - signature: ({ eventId, canManage }: { eventId: string; canManage: boolean }).
 *   - fetches its OWN data via getPartiesGovernmentData; returns null when that
 *     returns null so a no-access / missing event never throws inside Suspense.
 *   - 4a Parties Formed: name, symbol, leader; inline "Add symbol" fill-in when
 *     canManage && symbol empty (print:hidden).
 *   - 4b Government & Opposition: members grouped by parliament_role.
 */
import type {
  GovtMember,
  PartyFormed,
} from "@/lib/yip/report/sections/parties-government";
import { getPartiesGovernmentData } from "@/lib/yip/report/sections/parties-government";
import { PartySymbolFill } from "./PartySymbolFill";

/** True when the symbol looks like an image URL rather than an emoji/text mark. */
function isImageSymbol(symbol: string): boolean {
  return /^https?:\/\//i.test(symbol.trim());
}

function sideLabel(side: string | null): string | null {
  if (side === "ruling") return "Ruling";
  if (side === "opposition") return "Opposition";
  return null;
}

/** Renders a party's symbol — image URL → <img>, otherwise inline emoji/text. */
function PartySymbol({ party }: { party: PartyFormed }) {
  if (!party.symbolUrl) return null;
  if (isImageSymbol(party.symbolUrl)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={party.symbolUrl}
        alt={`${party.name} symbol`}
        className="size-9 shrink-0 rounded-md border border-[#1a1a3e]/10 object-contain"
      />
    );
  }
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-md border border-[#1a1a3e]/10 bg-[#FF9933]/5 text-xl leading-none"
      aria-hidden="true"
    >
      {party.symbolUrl}
    </span>
  );
}

/** A single bench member row (PM, minister, LoP, …). */
function MemberRow({ member }: { member: GovtMember }) {
  return (
    <li className="flex items-baseline justify-between gap-3 rounded-lg border border-[#1a1a3e]/8 bg-white px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#1a1a3e]">
          {member.name}
          {member.partyNumber != null ? (
            <span className="ml-1.5 text-xs font-normal text-[#1a1a3e]/45">
              · P{member.partyNumber}
            </span>
          ) : null}
        </p>
        {member.constituency ? (
          <p className="truncate text-xs text-[#1a1a3e]/50">
            {member.constituency}
          </p>
        ) : null}
      </div>
      <span className="shrink-0 text-right text-xs text-[#1a1a3e]/60">
        {member.roleLabel}
        {member.portfolio ? (
          <span className="block text-[#138808]">{member.portfolio}</span>
        ) : null}
      </span>
    </li>
  );
}

function Bench({
  title,
  members,
  emptyText,
}: {
  title: string;
  members: GovtMember[];
  emptyText: string;
}) {
  return (
    <div className="break-inside-avoid">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#1a1a3e]/45">
        {title}
      </h4>
      {members.length > 0 ? (
        <ul className="space-y-2">
          {members.map((m, i) => (
            <MemberRow key={`${m.name}-${m.roleLabel}-${i}`} member={m} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[#1a1a3e]/40">{emptyText}</p>
      )}
    </div>
  );
}

export default async function PartiesGovernmentSection({
  eventId,
  canManage,
}: {
  eventId: string;
  canManage: boolean;
}) {
  const data = await getPartiesGovernmentData(eventId);
  if (!data) return null;

  const { parties, presiding, government, opposition } = data;

  return (
    <div className="space-y-8">
      {/* 4a — Parties Formed */}
      <div className="break-inside-avoid">
        <h3 className="mb-3 text-sm font-semibold text-[#1a1a3e]">
          Parties Formed
        </h3>
        {parties.length > 0 ? (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {parties.map((p) => {
              const side = sideLabel(p.side);
              return (
                <li
                  key={p.id}
                  className="flex items-start gap-3 rounded-lg border border-[#1a1a3e]/8 bg-white px-3 py-2.5"
                >
                  <PartySymbol party={p} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-[#1a1a3e]">
                        {p.name}
                        {p.partyNumber != null ? (
                          <span className="ml-1.5 text-xs font-normal text-[#1a1a3e]/45">
                            · Party {p.partyNumber}
                          </span>
                        ) : null}
                      </p>
                      {side ? (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            p.side === "ruling"
                              ? "bg-[#138808]/10 text-[#138808]"
                              : "bg-[#1a1a3e]/8 text-[#1a1a3e]/60"
                          }`}
                        >
                          {side}
                        </span>
                      ) : null}
                    </div>
                    {p.tagline ? (
                      <p className="mt-0.5 truncate text-xs italic text-[#1a1a3e]/55">
                        {p.tagline}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-[#1a1a3e]/60">
                      Leader:{" "}
                      <span className="font-medium text-[#1a1a3e]/80">
                        {p.leaderName ?? "—"}
                      </span>
                    </p>
                    {!p.symbolUrl && canManage ? (
                      <PartySymbolFill eventId={eventId} partyId={p.id} />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-[#1a1a3e]/40">
            No parties recorded for this event.
          </p>
        )}
      </div>

      {/* 4b — Government & Opposition */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Bench
          title="Government (Treasury Bench)"
          members={government}
          emptyText="No government roles assigned."
        />
        <Bench
          title="Opposition"
          members={opposition}
          emptyText="No opposition roles assigned."
        />
      </div>

      {presiding.length > 0 ? (
        <Bench
          title="Presiding Officers"
          members={presiding}
          emptyText="No presiding officer assigned."
        />
      ) : null}
    </div>
  );
}
