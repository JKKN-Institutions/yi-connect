import { getParticipationRollup } from "@/lib/yip/national/corpus-extras";
import { getMinistryCoverage } from "@/lib/yip/national/corpus";
import { Handshake, Landmark, Layers } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════
// PANEL — "Positioning & Collaboration".
//
// The national team's pitch surface: how YIP sits ALONGSIDE the Government of
// India's own Viksit Bharat Youth Parliament (VBYP, run by the Ministry of
// Youth Affairs & Sports via MY Bharat) — framed as COMPLEMENTARY, never as a
// rival that is "better". VBYP brings national breadth, reach and legitimacy;
// YIP brings depth, structured deliberation and policy-grade output. Yi's offer
// is to be the depth-and-output engine FOR the nation's youth-parliament
// movement, not a competitor to it.
//
// The comparison is static, sourced strategy. The "depth at scale" line is
// LIVE — pulled from the same non-mock corpus the other panels use — so the
// claim is backed by real counts, never adjectives. NO LLM.
//
// VBYP facts are documented (PIB / MY Bharat, June 2026): Ministry of Youth
// Affairs & Sports; District (300 nodal districts) → State (assembly venues) →
// National (Samvidhan Sadan, New Delhi); ages 18–25; entry via a 1-minute
// video; inaugurated by Lok Sabha Speaker. Kept factual + constructive.
// ═══════════════════════════════════════════════════════════════════════

const NAVY = "#1a1a3e";
const SAFFRON = "#FF9933";
const GREEN = "#138808";

function Column({
  title,
  tag,
  accent,
  points,
}: {
  title: string;
  tag: string;
  accent: string;
  points: string[];
}) {
  return (
    <div className="flex-1 rounded-lg border border-[#1a1a3e]/8 bg-[#1a1a3e]/[0.015] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
          style={{ backgroundColor: accent }}
        >
          {tag}
        </span>
        <h3 className="text-[13px] font-semibold text-[#1a1a3e]">{title}</h3>
      </div>
      <ul className="space-y-1.5">
        {points.map((p, i) => (
          <li
            key={i}
            className="flex gap-2 text-[12px] leading-relaxed text-[#1a1a3e]/70"
          >
            <span
              className="mt-1.5 size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: accent }}
            />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function PositioningPanel() {
  const [participation, ministry] = await Promise.all([
    getParticipationRollup(),
    getMinistryCoverage(),
  ]);

  const depthMetrics = [
    { label: "chapters", value: participation.chapters_with_round },
    { label: "delegates", value: participation.delegates },
    { label: "schools", value: participation.schools },
    { label: "zones", value: participation.zones_covered },
    { label: "ministries deliberated", value: ministry.totals.ministries_touched },
  ];
  const hasDepth =
    participation.chapters_with_round > 0 || ministry.totals.ministries_touched > 0;

  return (
    <section className="overflow-hidden rounded-xl border border-[#1a1a3e]/8 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-[#1a1a3e]/8 px-5 py-4">
        <Handshake className="size-4 shrink-0" style={{ color: SAFFRON }} />
        <div>
          <h2 className="text-sm font-semibold text-[#1a1a3e]">
            Positioning &amp; Collaboration
          </h2>
          <p className="text-[12px] text-[#1a1a3e]/50">
            Yi as the depth engine for the nation&rsquo;s youth-parliament movement
          </p>
        </div>
      </div>

      <div className="p-5">
        {/* Complementary, not competing */}
        <div
          className="mb-4 flex items-start gap-2 rounded-lg border px-4 py-3"
          style={{ borderColor: `${GREEN}33`, backgroundColor: `${GREEN}0a` }}
        >
          <Layers className="mt-0.5 size-4 shrink-0" style={{ color: GREEN }} />
          <p className="text-[13px] leading-relaxed text-[#1a1a3e]/75">
            <span className="font-semibold text-[#1a1a3e]">
              Complementary, not competing.
            </span>{" "}
            The Government&rsquo;s Viksit Bharat Youth Parliament brings the{" "}
            <span className="font-semibold">nation</span> — reach, scale and
            legitimacy. YIP brings the <span className="font-semibold">depth</span>{" "}
            — structured deliberation and policy-grade output. Neither replaces
            the other.
          </p>
        </div>

        {/* Side-by-side */}
        <div className="flex flex-col gap-3 md:flex-row">
          <Column
            title="Viksit Bharat Youth Parliament"
            tag="Breadth"
            accent={NAVY}
            points={[
              "Government-run — Ministry of Youth Affairs & Sports, via MY Bharat; inaugurated by the Lok Sabha Speaker at Samvidhan Sadan",
              "300 nodal districts → State Assemblies → National — unmatchable reach & legitimacy",
              "Ages 18–25 (college / young adults)",
              "Entry via a 1-minute video; tiered speech & civic dialogue",
              "Outcome: national-scale civic engagement & a flagship event",
            ]}
          />
          <Column
            title="Young Indians Parliament (YIP)"
            tag="Depth"
            accent={SAFFRON}
            points={[
              "Full simulation: parties, government formation, committees mapped to ministries, bill drafting, voting, jury scoring",
              "School students (~Class 10) — reaches future citizens earlier in the pipeline",
              "Produces structured policy artifacts: bills tagged to ministries & schemes, deliberated verdicts",
              "Repeatable per chapter → a year-over-year youth-policy instrument",
              "Industry-mentored (CII) + Yi member mentorship — an employability bridge",
            ]}
          />
        </div>

        {/* Collaboration thesis */}
        <div className="mt-4 rounded-lg border border-[#FF9933]/25 bg-[#FF9933]/[0.06] p-4">
          <div className="mb-1.5 flex items-center gap-2">
            <Landmark className="size-4 shrink-0" style={{ color: SAFFRON }} />
            <h3 className="text-[13px] font-semibold text-[#1a1a3e]">
              How the Government can collaborate with Young Indians
            </h3>
          </div>
          <p className="text-[12px] leading-relaxed text-[#1a1a3e]/70">
            Yi does not seek to run a rival youth parliament. Yi offers to be the{" "}
            <span className="font-semibold">depth-and-output partner</span> for
            the nation&rsquo;s youth-parliament movement: a{" "}
            <span className="font-semibold">school-level feeder pipeline</span>{" "}
            into VBYP&rsquo;s 18–25 funnel; a proven{" "}
            <span className="font-semibold">
              bill-drafting &amp; deliberation methodology
            </span>{" "}
            the Government can adopt; and a{" "}
            <span className="font-semibold">year-round instrument</span> that
            converts youth engagement into actionable, ministry-mapped policy
            signal — turning a memorable event into continuous youth-policy
            intelligence for Viksit Bharat&nbsp;@2047.
          </p>
        </div>

        {/* Live depth-at-scale, backing the claim with real counts */}
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#1a1a3e]/40">
            YIP depth, at scale {hasDepth ? "(live)" : "(scales as rounds run)"}
          </p>
          <div className="flex flex-wrap gap-2">
            {depthMetrics.map((m) => (
              <div
                key={m.label}
                className="rounded-lg border border-[#1a1a3e]/8 bg-white px-3 py-2"
              >
                <span className="text-base font-bold text-[#1a1a3e]">
                  {m.value.toLocaleString("en-IN")}
                </span>
                <span className="ml-1.5 text-[11px] text-[#1a1a3e]/55">
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-[10px] leading-relaxed text-[#1a1a3e]/40">
          VBYP details: Ministry of Youth Affairs &amp; Sports / MY Bharat,
          June 2026 (PIB &amp; mybharat.gov.in). Framed as complementary; figures
          above are direct counts from real (non-demo) YIP rounds only.
        </p>
      </div>
    </section>
  );
}
