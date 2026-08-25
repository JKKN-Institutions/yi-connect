import Link from "next/link";
import { requireYiqSuperAdmin } from "@/lib/yiq/auth/require-super-admin";
import { Forbidden403 } from "../../_components/Forbidden403";
import {
  listGrantableYiqRoles,
  listYiqScopeOptions,
  listYiqTeam,
} from "../../actions/admin-team";
import { TeamManager } from "./team-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "YIQ team" };

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

export default async function YiqTeamPage() {
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) {
    return (
      <Forbidden403
        what="the YIQ team page"
        reason="not_yiq_super_admin"
      />
    );
  }

  const [teamRes, optionsRes, grantable] = await Promise.all([
    listYiqTeam(),
    listYiqScopeOptions(),
    listGrantableYiqRoles(),
  ]);

  // An explicit failure, never an empty page pretending everything is fine.
  if (!teamRes.success || !optionsRes.success) {
    const message = !teamRes.success
      ? teamRes.error
      : !optionsRes.success
        ? optionsRes.error
        : "Unknown error";
    return (
      <main
        id="yiq-main"
        className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6"
        style={{ background: INK, color: PAPER }}
      >
        <p className="yiq-eyebrow" style={{ color: SAFFRON }}>
          Could not load the team
        </p>
        <p className="mt-3 text-[0.9375rem] leading-relaxed" style={{ color: DIM }}>
          {message}
        </p>
        <Link
          href="/yiq/admin"
          className="mt-7 self-start rounded-full px-5 py-3 text-[0.875rem] font-bold"
          style={{ background: SAFFRON, color: INK }}
        >
          Back to national admin
        </Link>
      </main>
    );
  }

  const { granted, derived, unmanaged } = teamRes.team;

  return (
    <main id="yiq-main" style={{ background: INK, minHeight: "100vh", color: PAPER }}>
      <header className="border-b" style={{ borderColor: RULE }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link href="/yiq/admin" className="text-[0.875rem]" style={{ color: DIM }}>
            ← National admin
          </Link>
          <span className="yiq-eyebrow" style={{ color: SAFFRON }}>
            YIQ team
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
        <h1 className="yiq-display text-[2.25rem] sm:text-[2.75rem]">
          Who runs YIQ
        </h1>
        <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed" style={{ color: DIM }}>
          Roles live in the Yi directory — the one place every Yi app reads. A
          role granted here works on the person&apos;s very next page load, and
          removing it takes effect just as fast.
        </p>

        <dl className="mt-7 grid grid-cols-2 gap-3">
          <div className="rounded-xl border p-4" style={{ borderColor: RULE }}>
            <dt className="yiq-eyebrow" style={{ color: DIM }}>
              Granted here
            </dt>
            <dd className="yiq-data mt-1.5 text-[1.75rem] font-bold">
              {granted.length}
            </dd>
          </div>
          <div className="rounded-xl border p-4" style={{ borderColor: RULE }}>
            <dt className="yiq-eyebrow" style={{ color: DIM }}>
              Chairs, automatic
            </dt>
            <dd className="yiq-data mt-1.5 text-[1.75rem] font-bold">
              {derived.length}
            </dd>
          </div>
        </dl>

        <TeamManager
          granted={granted}
          derived={derived}
          unmanaged={unmanaged}
          chapters={optionsRes.options.chapters}
          zones={optionsRes.options.zones}
          grantableRoles={grantable}
        />
      </div>
    </main>
  );
}
