// THROWAWAY visual-check route — removed before merge. Renders the redesign
// primitives + a real redesigned component so the serif/eyebrow/SectionShell
// can be eyeballed on the Vercel preview without auth.
import {
  INK,
  SAFFRON,
  GREEN,
  SERIF,
  inkA,
  SectionShell,
  SectionHeading,
} from "@/app/yip/me/credential-ui";
import { PipelineClient } from "@/app/yip/dashboard/admin/pipeline/pipeline-client";
import { Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ZPreview() {
  return (
    <div
      className="mx-auto max-w-3xl space-y-8 p-8"
      style={{ background: "#faf7f2", minHeight: "100vh" }}
    >
      <div>
        <p
          className="text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ color: SAFFRON }}
        >
          Visual Check
        </p>
        <h1
          className="mt-0.5 text-2xl font-bold tracking-tight"
          style={{ ...SERIF, color: INK }}
        >
          Serif Heading Renders
        </h1>
        <p className="text-sm" style={{ color: inkA(0.5) }}>
          Eyebrow + Playfair serif + ink subtitle
        </p>
      </div>

      <div className="flex gap-8">
        <div>
          <p className="text-xs uppercase" style={{ color: inkA(0.5) }}>
            Avg Score
          </p>
          <p className="text-2xl font-bold" style={{ ...SERIF, color: INK }}>
            92.4
          </p>
        </div>
        <div>
          <p className="text-xs uppercase" style={{ color: inkA(0.5) }}>
            Qualified
          </p>
          <p className="text-2xl font-bold" style={{ ...SERIF, color: GREEN }}>
            17
          </p>
        </div>
      </div>

      <SectionShell accent={SAFFRON} className="p-5">
        <SectionHeading eyebrow="Section" title="SectionShell + heading" icon={Trophy} />
        <p className="mt-2 text-sm" style={{ color: inkA(0.6) }}>
          White paper, hairline ink border, saffron top rule.
        </p>
      </SectionShell>

      {/* A real redesigned component in its empty state (renders the SectionShell empty card). */}
      <PipelineClient seasons={[]} />
    </div>
  );
}
