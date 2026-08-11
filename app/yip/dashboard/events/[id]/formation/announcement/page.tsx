/**
 * Formation — the printable Oath-session announcement list.
 *
 * The formed House exactly as the Speaker reads it out at "Oath Taking &
 * Constitution of the House": Speaker + Deputies, party leaders, PM, LoP,
 * Cabinet/Shadow (with ministries), Deputy Ministers and the Officials.
 * Read-only; canView-gated (plan §4). Reuses the chapter report's print
 * stylesheet so Print / Save-as-PDF produces a clean handout.
 */
import type { Metadata } from "next";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { getEvent } from "@/app/yip/actions/events";
import { getFormationAnnouncement } from "@/app/yip/actions/formation";
import type { FormationAnnouncementPerson } from "@/lib/yip/formation";
import { PrintButton } from "../../report/PrintButton";
import { INK, SAFFRON, SERIF } from "@/app/yip/me/credential-ui";
import "../../report/report-print.css";

export const metadata: Metadata = {
  title: "House Announcement — YIP 2026",
};

function PersonLine({
  person,
  showMinistry = false,
}: {
  person: FormationAnnouncementPerson;
  showMinistry?: boolean;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-[#1a1a3e]/5 py-1.5">
      <span className="text-sm font-medium" style={{ color: INK }}>
        {person.full_name}
        {showMinistry && person.ministry && (
          <span className="ml-2 text-xs font-normal text-[#1a1a3e]/60">
            {person.ministry}
          </span>
        )}
      </span>
      {person.school_name && (
        <span className="shrink-0 text-xs text-[#1a1a3e]/45">
          {person.school_name}
        </span>
      )}
    </li>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="break-inside-avoid">
      <h2
        className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em]"
        style={{ color: SAFFRON }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

const EMPTY = (
  <p className="py-1.5 text-xs italic text-[#1a1a3e]/40">Not yet decided</p>
);

export default async function AnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const access = await getYipEventAccess(id);
  if (!access.canView) {
    return (
      <Forbidden403 reason="Only this event's team can view the House announcement list." />
    );
  }

  const event = await getEvent(id);
  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event, or it may have been deleted." />
    );
  }

  const res = await getFormationAnnouncement(id);
  if (!res.success) {
    return <Forbidden403 reason={res.error} />;
  }
  const a = res.data;

  return (
    <div className="mx-auto max-w-2xl bg-white p-6 print:p-0">
      {/* Toolbar (hidden in print) */}
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <p className="text-xs text-[#1a1a3e]/50">
          Read at the Oath session — Constitution of the House.
        </p>
        <PrintButton />
      </div>

      <header className="border-b-2 pb-4" style={{ borderColor: INK }}>
        <p
          className="text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ color: SAFFRON }}
        >
          Young Indians Parliament 2026 — Regional Round
        </p>
        <h1 className="mt-1 text-2xl font-bold" style={{ ...SERIF, color: INK }}>
          Constitution of the House
        </h1>
        <p className="mt-1 text-sm text-[#1a1a3e]/60">{event.name}</p>
      </header>

      <Section title="Speaker of the House">
        {a.speaker ? (
          <ul>
            <PersonLine person={a.speaker} />
          </ul>
        ) : (
          EMPTY
        )}
      </Section>

      <Section title="Deputy Speakers">
        {a.deputySpeakers.length > 0 ? (
          <ul>
            {a.deputySpeakers.map((p) => (
              <PersonLine key={p.id} person={p} />
            ))}
          </ul>
        ) : (
          EMPTY
        )}
      </Section>

      <Section title="Prime Minister">
        {a.primeMinister ? (
          <ul>
            <PersonLine person={a.primeMinister} />
          </ul>
        ) : (
          EMPTY
        )}
      </Section>

      <Section title="Leader of the Opposition">
        {a.leaderOfOpposition ? (
          <ul>
            <PersonLine person={a.leaderOfOpposition} />
          </ul>
        ) : (
          EMPTY
        )}
      </Section>

      <Section title="Party Leaders">
        {a.partyLeaders.length > 0 ? (
          <ul>
            {a.partyLeaders.map((pl) => (
              <li
                key={pl.partyId}
                className="flex items-baseline justify-between gap-3 border-b border-[#1a1a3e]/5 py-1.5"
              >
                <span className="text-sm font-medium" style={{ color: INK }}>
                  {pl.leader ? pl.leader.full_name : "—"}
                </span>
                <span className="shrink-0 text-xs text-[#1a1a3e]/45">
                  {pl.partyName}
                  {pl.side ? ` · ${pl.side}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          EMPTY
        )}
      </Section>

      <Section title="Cabinet Ministers">
        {a.cabinetMinisters.length > 0 ? (
          <ul>
            {a.cabinetMinisters.map((p) => (
              <PersonLine key={p.id} person={p} showMinistry />
            ))}
          </ul>
        ) : (
          EMPTY
        )}
      </Section>

      <Section title="Shadow Ministers">
        {a.shadowMinisters.length > 0 ? (
          <ul>
            {a.shadowMinisters.map((p) => (
              <PersonLine key={p.id} person={p} showMinistry />
            ))}
          </ul>
        ) : (
          EMPTY
        )}
      </Section>

      <Section title="Deputy Ministers">
        {a.deputyMinisters.length > 0 ? (
          <ul>
            {a.deputyMinisters.map((p) => (
              <PersonLine key={p.id} person={p} showMinistry />
            ))}
          </ul>
        ) : (
          EMPTY
        )}
      </Section>

      <Section title="Parliamentary Officials">
        {a.officials.length > 0 ? (
          <ul>
            {a.officials.map((p) => (
              <li
                key={`${p.id}-${p.role}`}
                className="flex items-baseline justify-between gap-3 border-b border-[#1a1a3e]/5 py-1.5"
              >
                <span className="text-sm font-medium" style={{ color: INK }}>
                  {p.full_name}
                  <span className="ml-2 text-xs font-normal text-[#1a1a3e]/60">
                    {p.role === "parliamentary_administrator"
                      ? "Parliamentary Administrator"
                      : "Parliamentary Journalist"}
                  </span>
                </span>
                {p.school_name && (
                  <span className="shrink-0 text-xs text-[#1a1a3e]/45">
                    {p.school_name}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          EMPTY
        )}
      </Section>
    </div>
  );
}
