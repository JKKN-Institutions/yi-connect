import { Users } from "lucide-react";

export interface HeroCredentialProps {
  name: string;
  /** Office held — e.g. "Cabinet Minister". Falls back to "Member of Parliament". */
  roleLabel: string | null;
  side: "ruling" | "opposition" | null;
  partyName: string | null;
  partyNumber: number | null;
  schoolDisplay: string;
  constituencyName: string | null;
  constituencyState: string | null;
  constituencyNumber: number | null;
  ministryLabel: string | null;
  committeeName: string | null;
  committeeNumber: number | null;
  committeeTopic: string | null;
  committeeScheme: string | null;
  /** Masthead session stamp — e.g. "ERODE · 2026". */
  sessionStamp: string;
}

// The YIP brand tokens (bg-ivory/text-navy/text-saffron…) come from
// app/yip/globals.css, which is imported nowhere, so those utilities are dead —
// the rest of the YIP app uses literal hex for the same reason. We do too.
const INK = "#1a1a3e"; // navy
const SAFFRON = "#C2691A"; // readable saffron on ivory paper
const GREEN = "#138808";
const GOLD = "#C9A24E";
// The display serif IS available: next/font sets --font-heading on the YIP
// layout wrapper, even though the `font-heading` utility was never generated.
const SERIF = { fontFamily: "var(--font-heading), ui-serif, Georgia, serif" };

/** Ashoka-chakra-inspired seal, drawn as a faint watermark. */
function ChakraSeal() {
  const spokes = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 15 * Math.PI) / 180;
    return {
      x1: 50 + 6 * Math.cos(a),
      y1: 50 + 6 * Math.sin(a),
      x2: 50 + 34 * Math.cos(a),
      y2: 50 + 34 * Math.sin(a),
    };
  });
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="46" />
      <circle cx="50" cy="50" r="34" />
      <circle cx="50" cy="50" r="6" fill="currentColor" stroke="none" />
      {spokes.map((s, i) => (
        <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
      ))}
    </svg>
  );
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <p
        className="text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: `${INK}73` }}
      >
        {label}
      </p>
      <div
        className="mt-1 text-[13.5px] font-semibold leading-snug"
        style={{ color: `${INK}d9` }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The Member's Credential — the participant's parliamentary identity rendered
 * like an official House credential rather than a generic profile card. Ivory
 * paper, a tricolour masthead rule, the name engraved in the display serif, a
 * faint Ashoka-chakra seal, and the record (school / constituency / portfolio /
 * committee) set below a gold hairline. Pure display; all data arrives as props.
 */
export function HeroCredential({
  name,
  roleLabel,
  side,
  partyName,
  partyNumber,
  schoolDisplay,
  constituencyName,
  constituencyState,
  constituencyNumber,
  ministryLabel,
  committeeName,
  committeeNumber,
  committeeTopic,
  committeeScheme,
  sessionStamp,
}: HeroCredentialProps) {
  const office = roleLabel ?? "Member of Parliament";
  const partyLabel =
    partyName ??
    (partyNumber != null
      ? `Party ${partyNumber}`
      : side === "ruling"
        ? "Ruling Party"
        : side === "opposition"
          ? "Opposition Party"
          : "Independent");

  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-[0_12px_30px_-12px_rgba(26,26,62,0.22)]"
      style={{ background: "#FEFCF6", border: `1px solid ${INK}1a` }}
    >
      {/* Tricolour masthead rule */}
      <div
        className="h-[5px] w-full"
        style={{
          background:
            "linear-gradient(to right, #FF9933 0 33.33%, #ffffff 33.33% 66.66%, #138808 66.66% 100%)",
        }}
      />

      {/* Faint chakra seal */}
      <div
        className="pointer-events-none absolute -bottom-7 -right-7 size-40"
        style={{ color: INK, opacity: 0.05 }}
      >
        <ChakraSeal />
      </div>

      <div className="relative px-5 pb-5 pt-3.5">
        {/* Masthead line */}
        <div className="flex items-center justify-between">
          <span
            className="text-[9.5px] font-bold uppercase tracking-[0.16em]"
            style={{ color: SAFFRON }}
          >
            Member of the House
          </span>
          <span
            className="font-mono text-[9.5px] tracking-wide"
            style={{ color: `${INK}66` }}
          >
            {sessionStamp}
          </span>
        </div>

        {/* Name + office */}
        <h1
          className="mt-2.5 text-[27px] font-bold leading-[1.08] tracking-tight"
          style={{ ...SERIF, color: INK }}
        >
          {name}
        </h1>
        <p
          className="mt-0.5 text-[14px] font-medium italic"
          style={{ ...SERIF, color: SAFFRON }}
        >
          {office}
        </p>

        {/* Party */}
        <div className="mt-3">
          <span
            className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold"
            style={{ color: INK, border: `1px solid ${INK}26` }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: side === "opposition" ? GREEN : "#FF9933" }}
            />
            {partyLabel}
            {side && (
              <span
                className="font-medium"
                style={{ color: side === "ruling" ? GREEN : SAFFRON }}
              >
                · {side === "ruling" ? "Ruling" : "Opposition"}
              </span>
            )}
          </span>
        </div>

        {/* Gold hairline */}
        <div className="my-4 flex items-center gap-2">
          <span
            className="h-px flex-1"
            style={{
              background: `linear-gradient(to right, transparent, ${GOLD}99, transparent)`,
            }}
          />
          <span
            className="size-[5px] rotate-45"
            style={{ background: GOLD }}
          />
          <span
            className="h-px flex-1"
            style={{
              background: `linear-gradient(to right, transparent, ${GOLD}99, transparent)`,
            }}
          />
        </div>

        {/* Record */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
          {schoolDisplay && (
            <Field label="School" wide>
              {schoolDisplay}
            </Field>
          )}
          {constituencyName && (
            <Field label="Constituency">
              {constituencyName}
              {constituencyState ? `, ${constituencyState}` : ""}
              {constituencyNumber != null && (
                <span
                  className="ml-1 font-mono font-medium"
                  style={{ color: `${INK}99` }}
                >
                  · #{constituencyNumber}
                </span>
              )}
            </Field>
          )}
          {ministryLabel && <Field label="Portfolio">{ministryLabel}</Field>}
          {committeeName && (
            <Field label="Committee" wide>
              <span
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: "#FFF3E6", color: SAFFRON }}
              >
                <Users className="size-3" />
                Committee {committeeNumber ?? "—"} · {committeeName}
              </span>
              {committeeTopic && (
                <p
                  className="mt-1.5 text-[12px] font-normal"
                  style={{ color: `${INK}8c` }}
                >
                  {committeeTopic}
                </p>
              )}
              {committeeScheme && (
                <p
                  className="mt-0.5 text-[11px] font-normal"
                  style={{ color: `${INK}66` }}
                >
                  Linked scheme: {committeeScheme}
                </p>
              )}
            </Field>
          )}
        </div>
      </div>
    </div>
  );
}
