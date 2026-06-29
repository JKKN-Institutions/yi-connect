import { requireFutureAdmin } from "@/lib/yi-future/auth/require-access";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { roleShortLabel } from "@/lib/yi-future/auth/chapter-permissions";
import { AdminShell, type NavItem } from "@/components/yi-future/admin/AdminShell";
import { GuideLauncher, OnboardingLauncher } from "@/components/yi-future/guide";
import { GUIDES } from "@/lib/yi-future/guide/content";
import { getCompletedSteps, logGuideEvent } from "@/lib/yi-future/guide/actions";

const NAV: NavItem[] = [
  { label: "Overview", href: "/yi-future/chapter" },
  { label: "Setup", href: "/yi-future/chapter/setup" },
  { label: "Outreach", href: "/yi-future/chapter/outreach" },
  { label: "Colleges", href: "/yi-future/chapter/colleges" },
  { label: "Delegates", href: "/yi-future/chapter/delegates" },
  { label: "Consent", href: "/yi-future/chapter/consent" },
  { label: "Teams", href: "/yi-future/chapter/teams" },
  { label: "Problem Statements", href: "/yi-future/chapter/problems" },
  { label: "Journey", href: "/yi-future/chapter/journey" },
  { label: "Messages", href: "/yi-future/chapter/messages" },
  { label: "Announcements", href: "/yi-future/chapter/announcements" },
  { label: "Mentors", href: "/yi-future/chapter/mentors" },
  { label: "Experts", href: "/yi-future/chapter/experts" },
  { label: "Jury", href: "/yi-future/chapter/jury" },
  { label: "Scoring", href: "/yi-future/chapter/scoring" },
  { label: "Final Event", href: "/yi-future/chapter/final" },
  { label: "Submissions", href: "/yi-future/chapter/submissions" },
  { label: "Results", href: "/yi-future/chapter/results" },
  { label: "Guide", href: "/yi-future/guide" },
];

export default async function ChapterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense-in-depth: block non-admins (delegates) from loading the admin
  // shell. Server actions are independently gated, but this stops the UI too.
  await requireFutureAdmin();

  // Role-aware badge (soft RBAC): chapter core-team members see their specific
  // role (Event Lead / Outreach Lead / …); national admins viewing the shell
  // (no chapter context) fall back to "Chapter".
  const ctx = await getChapterContext();
  const roleLabel = ctx ? roleShortLabel(ctx.role) : "Chapter";

  const completed = await getCompletedSteps("chapter");

  return (
    <>
      <AdminShell title="Chapter Admin" roleLabel={roleLabel} items={NAV}>
        <div className="mb-6">
          <OnboardingLauncher
            guide={GUIDES.lanes.chapter}
            basePath="/yi-future/guide"
            completed={completed}
            onEvent={logGuideEvent}
          />
        </div>
        {children}
      </AdminShell>
      <GuideLauncher guide={GUIDES.lanes.chapter} basePath="/yi-future/guide" variant="fab" />
    </>
  );
}
