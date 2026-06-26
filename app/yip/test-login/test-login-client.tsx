"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import {
  GraduationCap,
  Scale,
  Shield,
  Loader2,
  Sparkles,
  Crown,
  ArrowRight,
  Tv,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import {
  loginAsStudent,
  loginAsJury,
  loginAsVolunteer,
  loginAsOrganizer,
  type TestAccount,
} from "@/app/yip/actions/test-login";

export function TestLoginClient({
  students,
  jury,
  volunteers,
  organizer,
  hasMockData,
}: {
  students: TestAccount[];
  jury: TestAccount[];
  volunteers: TestAccount[];
  organizer: TestAccount;
  hasMockData: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function go(account: TestAccount) {
    setLoadingId(account.id);
    setError(null);
    startTransition(async () => {
      let res;
      if (account.kind === "student") {
        res = await loginAsStudent(account.id);
      } else if (account.kind === "jury") {
        res = await loginAsJury(account.id);
      } else if (account.kind === "volunteer") {
        res = await loginAsVolunteer(account.id);
      } else {
        res = await loginAsOrganizer();
      }
      if (!res.success) {
        setError(res.error);
        setLoadingId(null);
        return;
      }
      router.push(res.data.redirect);
    });
  }

  return (
    <div className="min-h-screen bg-[#FEFCF6]">
      <div className="max-w-[1200px] mx-auto px-6 py-10 space-y-8">
        {/* Tricolor header */}
        <div className="flex items-center gap-3 pb-4 border-b border-[#1a1a3e]/5">
          <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#FF9933] to-[#E68A2E] shadow-lg shadow-[#FF9933]/25">
            <span className="font-[family-name:var(--font-heading)] text-xl font-bold text-white">
              Y
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a3e]">
              Test Login — Demo Access
            </h1>
            <p className="text-xs text-[#1a1a3e]/60">
              One click to see the platform from every stakeholder's point of view
            </p>
          </div>
        </div>

        {!hasMockData && (
          <Card className="border-amber-300 bg-amber-50/50">
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    No mock data found
                  </p>
                  <p className="text-xs text-amber-800 mt-1">
                    Student + Jury buttons below will be empty. Seed demo data
                    first at{" "}
                    <Link
                      href="/yip/dashboard/admin/mock-data"
                      className="underline font-semibold"
                    >
                      /dashboard/admin/mock-data
                    </Link>
                    . You can still sign in as the Demo Organizer below to reach
                    that page.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Organizer */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="size-5 text-[#FF9933]" />
            <h2 className="text-lg font-semibold text-[#1a1a3e]">
              Organizer / Admin
            </h2>
          </div>
          <Card className="border-[#FF9933]/30 hover:border-[#FF9933] transition-colors">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full bg-gradient-to-br from-[#FF9933] to-[#E68A2E] flex items-center justify-center text-white">
                    <Crown className="size-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-[#1a1a3e]">
                      {organizer.label}
                    </div>
                    <div className="text-xs text-[#1a1a3e]/60 font-mono">
                      {organizer.sublabel}
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {organizer.badges.map((b) => (
                        <Badge
                          key={b}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {b}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => go(organizer)}
                  disabled={pending}
                  className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white min-w-[160px]"
                >
                  {pending && loadingId === organizer.id ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="size-4 mr-2" />
                  )}
                  Enter as Organizer
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Students */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="size-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-[#1a1a3e]">
              Student / Participant
            </h2>
            <Badge variant="secondary" className="text-[10px]">
              {students.length}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {students.map((s) => (
              <AccountCard
                key={s.id}
                account={s}
                onClick={() => go(s)}
                disabled={pending}
                loading={pending && loadingId === s.id}
              />
            ))}
          </div>
        </section>

        {/* Jury */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Scale className="size-5 text-violet-600" />
            <h2 className="text-lg font-semibold text-[#1a1a3e]">
              Jury Member
            </h2>
            <Badge variant="secondary" className="text-[10px]">
              {jury.length}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {jury.map((j) => (
              <AccountCard
                key={j.id}
                account={j}
                onClick={() => go(j)}
                disabled={pending}
                loading={pending && loadingId === j.id}
              />
            ))}
          </div>
        </section>

        {/* Volunteers (YUVA kiosks) */}
        {volunteers.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="size-5 text-teal-600" />
              <h2 className="text-lg font-semibold text-[#1a1a3e]">
                YUVA Volunteer (kiosk)
              </h2>
              <Badge variant="secondary" className="text-[10px]">
                {volunteers.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {volunteers.map((v) => (
                <AccountCard
                  key={v.id}
                  account={v}
                  onClick={() => go(v)}
                  disabled={pending}
                  loading={pending && loadingId === v.id}
                />
              ))}
            </div>
          </section>
        )}

        {/* Projector */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Tv className="size-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-[#1a1a3e]">
              Projector / Display (public, no auth)
            </h2>
          </div>
          <p className="text-xs text-[#1a1a3e]/60 mb-3">
            The auditorium projector view — shows current agenda item, active
            speaker, live timer, oath, bill voting. Open in a second monitor
            during a live event.
          </p>
          <div className="flex flex-wrap gap-2">
            {students.slice(0, 3).map(
              (s) =>
                s.event_name && (
                  <Link
                    key={s.id + "_display"}
                    href={`/yip/event/${s.id}/display`}
                    className="text-xs px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 inline-flex items-center gap-1"
                  >
                    {s.event_name}
                    <ChevronRight className="size-3" />
                  </Link>
                )
            )}
          </div>
        </section>

        {/* Footer */}
        <div className="pt-6 border-t border-[#1a1a3e]/5 text-center text-xs text-[#1a1a3e]/50">
          <p>
            Or go to{" "}
            <Link
              href="/yip/login"
              className="underline text-[#FF9933] font-semibold"
            >
              /login
            </Link>
            {" "}for real organizer credentials, or{" "}
            <Link
              href="/yip/join"
              className="underline text-[#FF9933] font-semibold"
            >
              /join
            </Link>
            {" "}to type a real access code.
          </p>
        </div>
      </div>
    </div>
  );
}

function AccountCard({
  account,
  onClick,
  disabled,
  loading,
}: {
  account: TestAccount;
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  const highlightStyle =
    account.highlight === "journey"
      ? "border-indigo-300 bg-gradient-to-br from-indigo-50/40 to-transparent"
      : account.highlight === "leader"
        ? "border-amber-200 bg-gradient-to-br from-amber-50/40 to-transparent"
        : "";

  const testIdKind =
    account.kind === "organizer"
      ? "organizer"
      : account.kind === "jury"
        ? "jury"
        : "student";
  const ariaLabel = `Log in as ${account.label}${account.sublabel ? ` (${account.sublabel})` : ""}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-testid={`login-${testIdKind}-${account.id}`}
      className="block w-full text-left p-0 bg-transparent border-0 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933] focus-visible:ring-offset-2 rounded-xl"
    >
      <Card
        className={`transition-all hover:shadow-md cursor-pointer ${highlightStyle}`}
      >
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {account.highlight === "journey" && (
                  <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[9px]">
                    <Sparkles className="size-2.5 mr-0.5" />
                    Journey
                  </Badge>
                )}
                {account.event_level && (
                  <Badge
                    className={`text-[9px] border uppercase ${
                      account.event_level === "chapter"
                        ? "bg-[#FF9933]/10 text-[#FF9933] border-[#FF9933]/20"
                        : account.event_level === "regional"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-[#138808]/10 text-[#138808] border-[#138808]/20"
                    }`}
                  >
                    {account.event_level}
                  </Badge>
                )}
              </div>
              <div className="font-semibold text-[#1a1a3e]">{account.label}</div>
              <div className="text-xs text-[#1a1a3e]/60">{account.sublabel}</div>
              {account.event_name && (
                <div className="text-[11px] text-[#1a1a3e]/50 mt-0.5">
                  {account.event_name}
                </div>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                {account.badges.map((b) => (
                  <Badge
                    key={b}
                    variant="secondary"
                    className="text-[10px] capitalize"
                  >
                    {b}
                  </Badge>
                ))}
              </div>
              {account.access_code && (
                <div className="text-[10px] text-[#1a1a3e]/40 font-mono mt-2">
                  code: {account.access_code}
                </div>
              )}
            </div>
            <div
              aria-hidden="true"
              className="shrink-0 inline-flex items-center justify-center size-8 rounded-md border border-input bg-background hover:bg-accent"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowRight className="size-3.5" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
