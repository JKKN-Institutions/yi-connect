import { getChapterCoverage } from "@/app/yip/actions/coverage";
import { CoverageClient } from "./coverage-client";

// Super-admin coverage map: which of the 65 chapters have run a YIP, grouped
// by region. Gated by the parent admin layout (requireSuperAdmin).
export default async function CoveragePage() {
  const report = await getChapterCoverage();

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <CoverageClient report={report} />
    </div>
  );
}
