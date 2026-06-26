import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { Globe2 } from "lucide-react";
import { ParticipationPanel } from "./_panels/ParticipationPanel";
import { CoveragePanel } from "./_panels/CoveragePanel";
import { VerdictByMinistryPanel } from "./_panels/VerdictByMinistryPanel";
import { BillPipelinePanel } from "./_panels/BillPipelinePanel";
import { PositioningPanel } from "./_panels/PositioningPanel";

// ═══════════════════════════════════════════════════════════════════════
// YIP NATIONAL INTELLIGENCE dashboard.
//
// Cross-event view for the Yi national team: across ALL chapter rounds, what
// did young India deliberate, mapped to GoI ministries + schemes. PLATFORM
// master data → requireSuperAdmin() (NOT event-scoped getYipEventAccess). The
// parent admin layout already gates, but we deny explicitly here too
// (defence-in-depth — a direct hit never silently renders).
//
// Each panel self-fetches its own corpus slice from lib/yip/national/* and
// renders its own honest empty state. This shell only lays them out and frames
// the "scales as rounds run" reality so an empty board reads as "not yet", not
// "broken".
//
// Deterministic build: tagging is the committee_name → topics join. The AI
// classification / verdict layer plugs into the corpus getters later; nothing
// here calls an LLM.
// ═══════════════════════════════════════════════════════════════════════

export default async function NationalIntelligencePage() {
  const gate = await requireSuperAdmin();
  if (!gate.ok) {
    return (
      <Forbidden403 reason="The National Intelligence dashboard is restricted to national / super-admins." />
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FF9933]/10">
            <Globe2 className="size-6 text-[#FF9933]" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#1a1a3e]">
                National Intelligence
              </h1>
              <span className="rounded-full border border-[#FF9933]/30 bg-[#FF9933]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#b15a00]">
                Foundation · scales as the 2026 season runs
              </span>
            </div>
            <p className="text-sm text-[#1a1a3e]/55">
              What young India deliberated across every chapter round — mapped to
              Government of India ministries &amp; schemes.
            </p>
          </div>
        </div>

        <p className="rounded-lg border border-[#1a1a3e]/8 bg-[#1a1a3e]/[0.02] px-4 py-3 text-[13px] leading-relaxed text-[#1a1a3e]/60">
          This is a living corpus. It counts only real (non-demo) chapter rounds
          and grows as the 2026 season runs — most chapters are still in draft,
          so panels may show small numbers or an empty state today. Nothing here
          is estimated: every figure is a direct count from what chapters have
          actually entered.
        </p>
      </header>

      {/* Participation spans full width — the top-of-board national reach headline. */}
      <div className="mb-6">
        <ParticipationPanel />
      </div>

      {/* Core corpus panels. Each is self-contained and copies the CoveragePanel
          pattern: server component, own corpus getter, own empty state. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <CoveragePanel />
        <VerdictByMinistryPanel />
        <BillPipelinePanel />
      </div>

      {/* Positioning & Collaboration — full width: how YIP complements the
          Government's Viksit Bharat Youth Parliament + the partnership thesis. */}
      <div className="mt-6">
        <PositioningPanel />
      </div>
    </div>
  );
}
