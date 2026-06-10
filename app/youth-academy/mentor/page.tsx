/**
 * Mentor dashboard shell (Phase 6; Phase 11 wired the real "My sessions"
 * list). Profile-completeness nudge + assigned upcoming/past sessions with
 * links to the session detail + cohort pages. The layout already gates
 * access; the page tailors content: mentors see their nudge + sessions,
 * staff see a viewing note.
 */

import Link from "next/link";
import {
  CalendarClock,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  MapPin,
  UserPen,
  Users,
} from "lucide-react";
import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";
import { createServiceClient as createYuvaService } from "@/lib/yuva/supabase/service";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mentor dashboard",
};

type ChecklistItem = { label: string; done: boolean };

export default async function MentorDashboardPage() {
  const access = await getYuvaAccess();
  // Defense-in-depth (layout already gates).
  if (!access.isMentor && !access.isNational && !access.chapterAdminOf) {
    return <Forbidden403 reason={`${access.reason}.`} />;
  }

  let checklist: ChecklistItem[] | null = null;
  let isPublic = false;

  if (access.isMentor && access.personId) {
    const yuva = await createYuvaService();
    const { data: profile } = await yuva
      .from("mentor_profiles")
      .select("bio, expertise, organization, photo_storage_path, is_public")
      .eq("person_id", access.personId)
      .maybeSingle();

    checklist = [
      { label: "Add a profile photo", done: !!profile?.photo_storage_path },
      { label: "Write a short bio", done: !!profile?.bio?.trim() },
      { label: "List your expertise", done: (profile?.expertise?.length ?? 0) > 0 },
      { label: "Add your organization", done: !!profile?.organization?.trim() },
    ];
    isPublic = profile?.is_public ?? false;
  }

  const doneCount = checklist?.filter((c) => c.done).length ?? 0;
  const profileComplete = checklist !== null && doneCount === checklist.length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-amber-600 uppercase">
          Mentor YUVA Network
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Mentor dashboard
        </h1>
        {!access.isMentor && (
          <p className="mt-1 text-sm text-slate-500">
            You&apos;re viewing the mentor area as staff — the profile nudge and
            session list appear for mentor accounts.
          </p>
        )}
      </div>

      {/* Profile-completeness nudge (mentors only) */}
      {checklist && !profileComplete && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPen className="size-4 text-amber-600" />
              Complete your profile ({doneCount}/{checklist.length})
            </CardTitle>
            <CardDescription>
              {isPublic
                ? "Your profile is public — a complete profile makes a much stronger card on the Mentor YUVA Network page."
                : "A complete profile is what students and chapters see on program pages and the public Mentor YUVA Network."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1.5">
              {checklist.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center gap-2 text-sm"
                >
                  {item.done ? (
                    <CircleCheck className="size-4 text-emerald-600" />
                  ) : (
                    <CircleDashed className="size-4 text-slate-400" />
                  )}
                  <span
                    className={
                      item.done ? "text-slate-400 line-through" : "text-slate-700"
                    }
                  >
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/youth-academy/mentor/profile"
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Edit my profile
            </Link>
          </CardContent>
        </Card>
      )}

      {checklist && profileComplete && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="flex items-center gap-3 py-4">
            <CircleCheck className="size-5 shrink-0 text-emerald-600" />
            <p className="text-sm text-slate-700">
              Your profile is complete
              {isPublic ? (
                <>
                  {" "}
                  and live on the{" "}
                  <Link
                    href="/youth-academy/mentors"
                    className="font-medium text-emerald-700 hover:underline"
                  >
                    public Mentor YUVA Network
                  </Link>
                  .
                </>
              ) : (
                <>
                  . Turn on &quot;Public profile&quot; in{" "}
                  <Link
                    href="/youth-academy/mentor/profile"
                    className="font-medium text-emerald-700 hover:underline"
                  >
                    your profile
                  </Link>{" "}
                  to appear on the public network page.
                </>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* My sessions — placeholder; Phase 11 wires the real list */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4 text-slate-500" />
            My sessions
          </CardTitle>
          <CardDescription>
            Sessions assigned to you across program runs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              No sessions to show yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              When a chapter assigns you to a session, it will appear here with
              the date, venue and cohort details.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
