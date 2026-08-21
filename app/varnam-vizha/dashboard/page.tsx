import type { Metadata } from "next";
import Link from "next/link";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { getDashboardData } from "@/lib/varnam/data/dashboard";
import { getWeekAhead, type WeekAhead } from "@/lib/varnam/data/tasks";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { logoutCommittee } from "@/app/varnam-vizha/actions/auth";
import { CalendarDays, Users, HandCoins, Wallet } from "lucide-react";

export const metadata: Metadata = { title: "Committee" };

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const fmtShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });

/** Compact "This Week" strip — the four numbers a chair checks first. */
function ThisWeekStrip({ week }: { week: WeekAhead }) {
  const hasOverdue = week.overdueCount > 0;
  const tileCls =
    "flex-1 min-w-[10rem] rounded-2xl border p-4 shadow-sm transition";

  return (
    <section aria-label="This week" className="mb-6">
      <div className="flex flex-wrap gap-3">
        {/* Overdue tasks */}
        <Link
          href="/varnam-vizha/dashboard/tasks"
          className={`${tileCls} ${
            hasOverdue
              ? "border-[#D6336C]/30 bg-[#D6336C]/5 hover:bg-[#D6336C]/10"
              : "border-[#3B0A45]/10 bg-white hover:bg-[#FFF9F0]"
          }`}
        >
          <p
            className={`font-[family-name:var(--font-vv-display)] text-2xl font-bold ${
              hasOverdue ? "text-[#b02a59]" : "text-[#3B0A45]"
            }`}
          >
            {hasOverdue ? "⚠ " : ""}
            {week.overdueCount}
          </p>
          <p
            className={`text-xs ${
              hasOverdue ? "font-medium text-[#b02a59]" : "text-[#2B0A33]/60"
            }`}
          >
            {hasOverdue ? "Overdue — needs chasing" : "Nothing overdue"}
          </p>
        </Link>

        {/* Due in 7 days */}
        <Link
          href="/varnam-vizha/dashboard/tasks"
          className={`${tileCls} border-[#3B0A45]/10 bg-white hover:bg-[#FFF9F0]`}
        >
          <p className="font-[family-name:var(--font-vv-display)] text-2xl font-bold text-[#3B0A45]">
            {week.dueThisWeekCount}
          </p>
          <p className="text-xs text-[#2B0A33]/60">Tasks due in 7 days</p>
        </Link>

        {/* Next milestone */}
        <div className={`${tileCls} border-[#3B0A45]/10 bg-white`}>
          {week.nextMilestone ? (
            <>
              <p className="font-[family-name:var(--font-vv-display)] text-2xl font-bold text-[#3B0A45]">
                {week.nextMilestone.daysToGo === 0
                  ? "Today"
                  : `${week.nextMilestone.daysToGo}d`}
              </p>
              <p className="truncate text-xs text-[#2B0A33]/60">
                {fmtShortDate(week.nextMilestone.due_date)} ·{" "}
                {week.nextMilestone.title}
              </p>
            </>
          ) : (
            <>
              <p className="font-[family-name:var(--font-vv-display)] text-2xl font-bold text-[#3B0A45]">
                —
              </p>
              <p className="text-xs text-[#2B0A33]/60">No upcoming milestone</p>
            </>
          )}
        </div>

        {/* Days to festival */}
        <div className={`${tileCls} border-[#F4A300]/30 bg-[#F4A300]/8`}>
          <p className="font-[family-name:var(--font-vv-display)] text-2xl font-bold text-[#3B0A45]">
            {week.festivalStartsInDays === null
              ? "—"
              : week.festivalStartsInDays > 0
                ? `${week.festivalStartsInDays} days`
                : "Live!"}
          </p>
          <p className="text-xs text-[#2B0A33]/60">
            {week.festivalStartsInDays !== null && week.festivalStartsInDays <= 0
              ? "The festival is underway"
              : week.festivalStartDate
                ? `Until the festival · ${fmtShortDate(week.festivalStartDate)}`
                : "Festival dates not set yet"}
          </p>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#3B0A45]/10 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-[#D6336C]">{icon}</div>
      <p className="mt-3 font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
        {value}
      </p>
      <p className="text-sm text-[#2B0A33]/60">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-[#2B0A33]/45">{sub}</p>}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#3B0A45]/10 bg-white p-6 shadow-sm">
      <h2 className="mb-4 font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#3B0A45]">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function VarnamDashboard() {
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;

  const [d, week] = await Promise.all([getDashboardData(), getWeekAhead()]);
  const budgetPct =
    d.budget && d.budget.total > 0
      ? Math.round((d.budget.spent / d.budget.total) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
            {d.edition?.name ?? "Varnam Vizha"} · Committee
          </h1>
          <p className="mt-1 text-sm text-[#2B0A33]/60">
            Signed in as{" "}
            <span className="font-medium text-[#2B0A33]">{access.role}</span> ·{" "}
            {access.canAdmin ? "admin" : access.canManage ? "manage" : "view"} access.
          </p>
        </div>
        <form action={logoutCommittee}>
          <button
            type="submit"
            className="rounded-full border border-[#3B0A45]/15 px-4 py-2 text-sm font-medium text-[#2B0A33] transition hover:bg-[#3B0A45]/5"
          >
            Sign out
          </button>
        </form>
      </div>

      {/* This Week — the four numbers a chair checks first */}
      <ThisWeekStrip week={week} />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<CalendarDays className="size-5" />}
          label="Events this edition"
          value={String(d.eventsCount)}
        />
        <StatCard
          icon={<Users className="size-5" />}
          label="Registrations"
          value={String(d.registrationsTotal)}
        />
        <StatCard
          icon={<HandCoins className="size-5" />}
          label="Sponsorship committed"
          value={inr(d.committedTotal)}
          sub={`${d.sponsors.length} sponsors in pipeline`}
        />
        <StatCard
          icon={<Wallet className="size-5" />}
          label="Budget spent"
          value={d.budget ? `${budgetPct}%` : "—"}
          sub={d.budget ? `${inr(d.budget.spent)} of ${inr(d.budget.total)}` : undefined}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Registrations */}
        <Panel title="Registrations by event">
          {d.registrationsByEvent.length === 0 ? (
            <p className="text-sm text-[#2B0A33]/50">No registrations yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {d.registrationsByEvent.map((r) => (
                <li key={r.title} className="flex items-center gap-3 text-sm">
                  <span className="w-7 shrink-0 text-right font-semibold text-[#D6336C]">
                    {r.count}
                  </span>
                  <span className="truncate text-[#2B0A33]/80">{r.title}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Sponsor pipeline */}
        <Panel title="Sponsor pipeline">
          {d.sponsors.length === 0 ? (
            <p className="text-sm text-[#2B0A33]/50">No sponsors yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {d.sponsors.map((s) => (
                <li
                  key={s.name}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate font-medium text-[#2B0A33]">
                    {s.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-[#3B0A45]/8 px-2 py-0.5 text-[11px] capitalize text-[#3B0A45]/70">
                      {s.status ?? "prospect"}
                    </span>
                    {s.amount ? (
                      <span className="font-semibold text-[#0a8485]">
                        {inr(s.amount)}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Budget */}
      <div className="mt-6">
        <Panel title="Budget — planned vs spent">
          {!d.budget ? (
            <p className="text-sm text-[#2B0A33]/50">No budget set.</p>
          ) : (
            <div className="space-y-4">
              {d.budget.allocations.map((a) => {
                const pct =
                  a.allocated > 0
                    ? Math.min(100, Math.round((a.spent / a.allocated) * 100))
                    : 0;
                return (
                  <div key={a.vertical}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-[#2B0A33]/80">{a.vertical}</span>
                      <span className="text-[#2B0A33]/55">
                        {inr(a.spent)} / {inr(a.allocated)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#3B0A45]/8">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#F4A300] to-[#D6336C]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
