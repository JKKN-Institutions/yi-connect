import {
  getGeographicFootprint,
  TOTAL_STATES_UTS,
  TOTAL_REGIONS,
  TOTAL_LS_SEATS,
} from "@/lib/yip/national/geography";
import { MapPinned, AlertCircle } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════
// PANEL — "National Footprint".
//
// Which real Indian constituencies young India represented across every chapter
// round, rolled up by region and state. Copies the CoveragePanel template:
// server component, one corpus getter (getGeographicFootprint), honest empty
// state, PanelShell chrome. Geography keys off constituency_NAME (a real Lok
// Sabha seat), never the in-room seat number. requireSuperAdmin gating lives in
// the getter + the page + the admin layout.
// ═══════════════════════════════════════════════════════════════════════

function PanelShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#1a1a3e]/8 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-[#1a1a3e]/8 px-5 py-4">
        <MapPinned className="size-4 shrink-0 text-[#FF9933]" />
        <div>
          <h2 className="text-sm font-semibold text-[#1a1a3e]">{title}</h2>
          {subtitle && <p className="text-[12px] text-[#1a1a3e]/50">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-[#1a1a3e]/8 bg-[#1a1a3e]/[0.02] px-3 py-2.5">
      <div className="text-lg font-semibold tabular-nums text-[#1a1a3e]">
        {value.toLocaleString("en-IN")}
        {suffix && (
          <span className="ml-0.5 text-[12px] font-medium text-[#1a1a3e]/40">
            {suffix}
          </span>
        )}
      </div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-[#1a1a3e]/45">
        {label}
      </div>
    </div>
  );
}

// Fixed tint per region so the same region reads the same colour every render.
const REGION_TINT: Record<string, string> = {
  North: "#FF9933",
  South: "#138808",
  East: "#1a6fb3",
  West: "#c2410c",
  Central: "#7c3aed",
  Northeast: "#0f766e",
};

export async function NationalFootprintPanel() {
  const report = await getGeographicFootprint();

  if (!report.hasData) {
    return (
      <PanelShell
        title="National Footprint"
        subtitle="Real constituencies represented, by state & region"
      >
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#1a1a3e]/15 px-4 py-10 text-center">
          <AlertCircle className="size-6 text-[#1a1a3e]/30" />
          <p className="text-sm font-medium text-[#1a1a3e]/70">
            No constituencies mapped yet
          </p>
          <p className="max-w-md text-[12px] leading-relaxed text-[#1a1a3e]/45">
            As chapters run their rounds and delegates take up their
            constituencies, the real Indian seats they represent will map here —
            across states and regions.
            {report.totals.events_in_scope > 0 && (
              <>
                {" "}
                {report.totals.events_in_scope.toLocaleString("en-IN")} real
                round{report.totals.events_in_scope === 1 ? "" : "s"} in scope so
                far.
              </>
            )}
          </p>
        </div>
      </PanelShell>
    );
  }

  const { totals, regions, topStates, unmatchedNames } = report;
  const maxRegion = Math.max(...regions.map((r) => r.participants), 1);
  const shownStates = topStates.slice(0, 12);

  return (
    <PanelShell
      title="National Footprint"
      subtitle="Real Indian constituencies young India represented, across every non-demo round"
    >
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat
          label="States & UTs"
          value={totals.states}
          suffix={`/ ${TOTAL_STATES_UTS}`}
        />
        <Stat
          label="Regions"
          value={totals.regions}
          suffix={`/ ${TOTAL_REGIONS}`}
        />
        <Stat
          label="Constituencies"
          value={totals.constituencies}
          suffix={`/ ${TOTAL_LS_SEATS}`}
        />
        <Stat label="Delegates placed" value={totals.participants} />
      </div>

      {/* Region breakdown — the headline reach story. */}
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#1a1a3e]/45">
        By region
      </div>
      <div className="mb-5 space-y-2.5">
        {regions.map((r) => {
          const pct = Math.round((r.participants / maxRegion) * 100);
          const tint = REGION_TINT[r.region] ?? "#FF9933";
          return (
            <div key={r.region}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-medium text-[#1a1a3e]">
                  {r.region}
                </span>
                <span className="text-[11px] tabular-nums text-[#1a1a3e]/50">
                  {r.states} state{r.states === 1 ? "" : "s"} · {r.seats} seat
                  {r.seats === 1 ? "" : "s"} ·{" "}
                  <span className="font-semibold text-[#1a1a3e]/70">
                    {r.participants.toLocaleString("en-IN")}
                  </span>{" "}
                  delegates
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#1a1a3e]/[0.06]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: tint }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Top states. */}
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#1a1a3e]/45">
        Most-represented states
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-0 sm:grid-cols-2">
        {shownStates.map((s, i) => (
          <div
            key={s.state}
            className="flex items-center justify-between border-b border-[#1a1a3e]/5 py-1.5 text-sm last:border-0"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-[#1a1a3e]/35">
                {i + 1}
              </span>
              <span className="truncate font-medium text-[#1a1a3e]">
                {s.state}
              </span>
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                style={{
                  color: REGION_TINT[s.region] ?? "#b15a00",
                  backgroundColor: `${REGION_TINT[s.region] ?? "#FF9933"}18`,
                }}
              >
                {s.region}
              </span>
            </div>
            <span className="shrink-0 tabular-nums text-[#1a1a3e]/70">
              {s.participants.toLocaleString("en-IN")}
              <span className="ml-1 text-[11px] text-[#1a1a3e]/40">
                · {s.seats} seat{s.seats === 1 ? "" : "s"}
              </span>
            </span>
          </div>
        ))}
      </div>
      {topStates.length > shownStates.length && (
        <p className="mt-2 text-[11px] text-[#1a1a3e]/40">
          Showing top {shownStates.length} of{" "}
          {topStates.length.toLocaleString("en-IN")} states/UTs represented.
        </p>
      )}

      <p className="mt-4 rounded-lg border border-[#1a1a3e]/8 bg-[#1a1a3e]/[0.02] px-3 py-2 text-[11px] leading-relaxed text-[#1a1a3e]/50">
        Mapped by constituency name to real Lok Sabha seats — the in-room seat
        number is not an official constituency number.
        {totals.unnamed > 0 && (
          <>
            {" "}
            {totals.unnamed.toLocaleString("en-IN")} delegate
            {totals.unnamed === 1 ? "" : "s"} have no constituency recorded yet.
          </>
        )}
      </p>

      {unmatchedNames.length > 0 && (
        <div className="mt-3 rounded-lg border border-dashed border-amber-300/60 bg-amber-50/60 px-3 py-2">
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            {totals.unmatched.toLocaleString("en-IN")} delegate
            {totals.unmatched === 1 ? "" : "s"} on unrecognised constituencies
          </p>
          <p className="text-[12px] leading-relaxed text-amber-800/80">
            {unmatchedNames
              .slice(0, 12)
              .map((u) => `${u.name}${u.count > 1 ? ` ×${u.count}` : ""}`)
              .join(" · ")}
            {unmatchedNames.length > 12 ? " …" : ""} — add these to the
            constituency reference to fold them into the footprint.
          </p>
        </div>
      )}
    </PanelShell>
  );
}
