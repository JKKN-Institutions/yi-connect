/**
 * Smart Guide — Yi Connect chapter-management content (PURE DATA).
 *
 * Scope: running and growing a Yi CHAPTER — onboarding a new chapter, onboarding
 * and approving members, and the day-to-day chapter operations (events, finance,
 * stakeholders, communication, recognition, leadership pipeline). This guide is
 * deliberately about chapter management only; it does NOT cover the other Yi apps
 * (YIP, Yi-Future, YiFi, Youth Academy) — those have their own guides.
 *
 * ONE guidebook drives the full page (/user-guide), the in-app drawer (the "?"
 * Help FAB + sidebar "Guide" item), the dashboard "Start onboarding" launcher,
 * and the next-step nudge. Authored from the app's real routes — every deep-link
 * was verified to resolve to a live page.
 *
 * Lanes map to the chapter's operating roles:
 *   member        ← Executive Member / EC Member (default for any member)
 *   leadership    ← Chapter Chair / Co-Chair        [gated: REQUIRES.lead]
 *   vertical_head ← Vertical Head                    [open — instructional]
 *   coordinator   ← Coordinator                      [open — instructional]
 *   national      ← National Admin / Super Admin     [gated: REQUIRES.national]
 *
 * Plain 12th-grade English. No marketing words. `**bold**` is the only markup.
 */
import type { GuideBook } from "./types";

/* ────────────────────────────────────────────────────────────────────────
 * Permission keys — defined ONCE here, imported by detect-lane.ts so a
 * lane's `requires` and the `can()` check can never silently drift.
 * ──────────────────────────────────────────────────────────────────────── */
export const REQUIRES = {
  /** Chapter Chair / Co-Chair level and above. */
  lead: "chapter.lead",
  /** National Admin / Super Admin only. */
  national: "national.manage",
} as const;

/** A short "Need help?" closer, reused at the end of every lane. */
const HELP_SECTION = {
  id: "get-help",
  title: "Get help",
  steps: [
    {
      action: "Hit a bug or something looks wrong? Use the **feedback button** in the bottom-right corner of any page.",
      detail: "It captures the screen for you so the fix is faster.",
    },
    {
      action: "Still stuck? Reach out to your **Chapter Chair or EC members** directly for urgent matters.",
    },
  ],
};

export const GUIDES: GuideBook = {
  lanes: {
    /* ══════════════════════════ MEMBER ══════════════════════════ */
    member: {
      persona: "member",
      title: "Member Guide",
      tagline: "Get set up as a chapter member and make the most of Yi.",
      whyItMatters:
        "A complete profile and steady participation lift your engagement score and get you matched to the right volunteer roles.",
      startHere: { label: "Open my dashboard", href: "/dashboard" },
      journey: ["Finish your setup", "Find events", "Join in", "Recognise others", "Grow in Yi"],
      sections: [
        {
          id: "onboarding",
          title: "Finish setting up your account",
          steps: [
            {
              action: "Complete your **profile** — photo, contact, skills, company and availability.",
              detail: "A complete profile improves your engagement score and helps leaders match you to volunteer work.",
              tip: "Add your skills and availability — that is what volunteer matching reads.",
              link: { label: "Go to profile settings", href: "/settings/profile" },
            },
            {
              action: "Set your **notification preferences** so you only get what you want.",
              link: { label: "Open settings", href: "/settings" },
            },
            {
              action: "Connect **WhatsApp** to get event reminders and important announcements.",
              detail: "You control which notifications you receive.",
              link: { label: "Set up WhatsApp", href: "/settings/whatsapp" },
            },
          ],
        },
        {
          id: "events",
          title: "Find and join events",
          steps: [
            {
              action: "Browse **upcoming events** and register your attendance.",
              tip: "RSVP early — it helps organisers plan and makes sure you get event updates.",
              link: { label: "Browse events", href: "/events" },
            },
            {
              action: "On the day, **check in** at the event so your attendance is recorded.",
              detail: "Attendance feeds your engagement score and your Yi track record.",
            },
          ],
        },
        {
          id: "knowledge",
          title: "Use the knowledge base",
          steps: [
            {
              action: "Browse **documents, templates, guides and best practices** shared with the chapter.",
              detail: "Use the categories and search to find what you need.",
              link: { label: "Open the knowledge base", href: "/knowledge" },
            },
          ],
        },
        {
          id: "recognise",
          title: "Recognise great work",
          steps: [
            {
              action: "Nominate someone for a **Take Pride award**.",
              detail: "Pick the category, choose the member, and write a short, specific nomination before the deadline.",
              link: { label: "Nominate someone", href: "/awards/nominate" },
            },
            {
              action: "See who is being recognised on the **leaderboard**.",
              link: { label: "View the leaderboard", href: "/awards/leaderboard" },
            },
          ],
        },
        {
          id: "grow",
          title: "Grow in Yi",
          steps: [
            {
              action: "Ready to lead? **Apply for a leadership role** when nominations are open.",
              link: { label: "Apply for a role", href: "/succession/apply" },
            },
            {
              action: "Spent your own money for Yi? **Claim a reimbursement**.",
              detail: "Add the amount, what it was for, and upload the receipt. You can track the approval status afterwards.",
              link: { label: "Claim a reimbursement", href: "/finance/reimbursements/new" },
            },
            {
              action: "See your own **Yi journey** — events, contributions and milestones.",
              link: { label: "View my journey", href: "/me/journey" },
            },
          ],
        },
        HELP_SECTION,
      ],
    },

    /* ══════════════════════════ LEADERSHIP ══════════════════════════ */
    leadership: {
      persona: "leadership",
      title: "Chapter Leadership Guide",
      tagline: "Onboard your members and run your chapter — events, money, stakeholders, communication and the leadership pipeline.",
      whyItMatters:
        "Your chapter's roster, events and reports are what national sees. Keeping them current — starting with onboarding members — is how your chapter gets recognised.",
      startHere: { label: "Review membership requests", href: "/member-requests" },
      requires: REQUIRES.lead,
      journey: ["Onboard members", "Run events", "Manage money", "Engage stakeholders", "Communicate", "Build leaders"],
      sections: [
        {
          id: "onboard-members",
          title: "Onboard your members",
          steps: [
            {
              action: "**Review and approve membership requests** — new applicants land here first.",
              detail:
                "Someone applies at the public join page; you approve them here, which whitelists their email and assigns them to your chapter so they can sign in.",
              tip: "Approve promptly — an applicant can't log in until you do.",
              link: { label: "Open membership requests", href: "/member-requests" },
            },
            {
              action: "Add a **member directly** — they get an invite email to set up their account.",
              detail: "Fill in email, name and membership type.",
              link: { label: "Add a member", href: "/members/new" },
            },
            {
              action: "Onboarding many at once? **Bulk-upload** members from a spreadsheet.",
              link: { label: "Bulk upload", href: "/members/bulk-upload" },
            },
            {
              action: "Browse the **member directory** and open any profile to see engagement, skills and event history.",
              link: { label: "Open the directory", href: "/members/table" },
            },
            {
              action: "Use the **skill-will matrix** to find the right people for the right work.",
              link: { label: "Open skill-will matrix", href: "/members/skill-will-matrix" },
            },
          ],
        },
        {
          id: "events",
          title: "Run events end to end",
          steps: [
            {
              action: "**Create an event** — title, date, venue, description, category and vertical.",
              detail: "Save as a draft, then publish when it is ready for members to see.",
              tip: "Add a banner image so the event stands out in the list.",
              link: { label: "Create an event", href: "/events/new" },
            },
            {
              action: "**Manage RSVPs and attendance** — track who is coming, mark attendance, send reminders.",
              link: { label: "Manage events", href: "/events/manage" },
            },
            {
              action: "After the event, file the **post-event report** with photos and outcomes.",
              detail: "Open the event from the list, then add its report — this is what national reviews for recognition.",
              link: { label: "Go to events", href: "/events" },
            },
          ],
        },
        {
          id: "money",
          title: "Manage chapter money",
          steps: [
            {
              action: "Review the chapter **budget** — spend by category and how much is used.",
              link: { label: "Open budgets", href: "/finance/budgets" },
            },
            {
              action: "**Review and approve expenses** members submit.",
              detail: "Approved expenses move into the reimbursement workflow per your chapter policy.",
              link: { label: "Open expenses", href: "/finance/expenses" },
            },
            {
              action: "Track **sponsorships** and the sponsorship pipeline.",
              link: { label: "Open sponsorships", href: "/finance/sponsorships" },
            },
          ],
        },
        {
          id: "stakeholders",
          title: "Grow stakeholder relationships",
          steps: [
            {
              action: "Open the **stakeholder CRM** — schools, colleges, industries, government, NGOs and vendors.",
              detail: "Add organisations, log interactions, and keep contact history in one place.",
              link: { label: "Open stakeholders", href: "/stakeholders" },
            },
            {
              action: "Watch each stakeholder's **health score** to see which relationships need attention.",
              tip: "Health scores rise with recent interactions and event collaborations — log them as they happen.",
            },
          ],
        },
        {
          id: "communicate",
          title: "Communicate with the chapter",
          steps: [
            {
              action: "Send an **announcement** to the whole chapter or a specific group.",
              detail: "Choose in-app, email or WhatsApp depending on how urgent it is.",
              link: { label: "New announcement", href: "/communications/announcements/new" },
            },
            {
              action: "Send a **WhatsApp broadcast** for reminders and time-sensitive updates.",
              link: { label: "Open WhatsApp", href: "/communications/whatsapp" },
            },
          ],
        },
        {
          id: "pipeline",
          title: "Recognise & build leaders",
          steps: [
            {
              action: "Run **Take Pride award cycles** for your chapter.",
              link: { label: "Manage award cycles", href: "/awards/admin/cycles" },
            },
            {
              action: "Manage the **succession & leadership pipeline** — cycles, nominations and evaluations.",
              link: { label: "Open succession admin", href: "/succession/admin" },
            },
          ],
        },
        HELP_SECTION,
      ],
    },

    /* ══════════════════════════ VERTICAL HEAD ══════════════════════════ */
    vertical_head: {
      persona: "vertical_head",
      title: "Vertical Head Guide",
      tagline: "Track your vertical's KPIs, log its activities, and see how it compares.",
      whyItMatters:
        "KPIs are calculated from the events and outcomes you log — keeping them current is how your vertical's progress shows up.",
      startHere: { label: "Open verticals", href: "/verticals" },
      journey: ["Open your vertical", "Track KPIs", "Log activities", "Compare rankings"],
      sections: [
        {
          id: "dashboard",
          title: "Your vertical dashboard",
          steps: [
            {
              action: "Open **Verticals**, then click into your own vertical to see its KPIs, events and progress.",
              link: { label: "Open verticals", href: "/verticals" },
            },
          ],
        },
        {
          id: "kpis",
          title: "Track KPIs & activities",
          steps: [
            {
              action: "On your vertical's page, **record KPIs** and log activities and achievements.",
              detail: "KPIs are calculated automatically from events conducted, participation and outcomes.",
              tip: "Update event reports promptly — that is what keeps KPI tracking accurate.",
            },
          ],
        },
        {
          id: "rankings",
          title: "See how you compare",
          steps: [
            {
              action: "View the **rankings** to see how your vertical compares to others.",
              link: { label: "Open rankings", href: "/verticals/rankings" },
            },
          ],
        },
        HELP_SECTION,
      ],
    },

    /* ══════════════════════════ COORDINATOR ══════════════════════════ */
    coordinator: {
      persona: "coordinator",
      title: "Coordinator Guide",
      tagline: "Handle bookings, schedule sessions, and keep event-day running smoothly.",
      whyItMatters:
        "Bookings and sessions you set up are what members and trainers rely on — clear scheduling keeps the day on track.",
      startHere: { label: "Open coordinator home", href: "/coordinator" },
      journey: ["Coordinator home", "Manage bookings", "Schedule sessions", "Run the day"],
      sections: [
        {
          id: "home",
          title: "Coordinator home",
          steps: [
            {
              action: "Open your **coordinator dashboard** to see what needs your attention.",
              link: { label: "Open coordinator", href: "/coordinator" },
            },
          ],
        },
        {
          id: "bookings",
          title: "Manage bookings",
          steps: [
            {
              action: "View existing **bookings**.",
              link: { label: "Open bookings", href: "/coordinator/bookings" },
            },
            {
              action: "Create a **new booking** for a venue or resource.",
              link: { label: "New booking", href: "/coordinator/bookings/new" },
            },
          ],
        },
        {
          id: "sessions",
          title: "Schedule sessions",
          steps: [
            {
              action: "Set up and manage **sessions** for your events.",
              link: { label: "Open sessions", href: "/coordinator/sessions" },
            },
          ],
        },
        {
          id: "event-day",
          title: "Run the day",
          steps: [
            {
              action: "Manage live events and **attendance check-in** from the events area.",
              link: { label: "Manage events", href: "/events/manage" },
            },
            {
              action: "Track delivery against the chapter plan with **Pathfinder health cards**.",
              link: { label: "Open health cards", href: "/pathfinder/health-card" },
            },
          ],
        },
        HELP_SECTION,
      ],
    },

    /* ══════════════════════════ NATIONAL / ADMIN ══════════════════════════ */
    national: {
      persona: "national",
      title: "National & Admin Guide",
      tagline: "Onboard new chapters and oversee the chapter network — admins, benchmarks, broadcasts and data sync.",
      whyItMatters:
        "You set up the chapters and admins everything else runs on. Onboarding a chapter correctly is what lets its team start operating.",
      startHere: { label: "Manage chapters", href: "/admin/chapters" },
      requires: REQUIRES.national,
      journey: ["Onboard a chapter", "Set up admins", "Benchmark", "Broadcast", "Oversee awards & succession"],
      sections: [
        {
          id: "onboard-chapter",
          title: "Onboard a new chapter",
          steps: [
            {
              action: "**Create a new chapter** — name, region and feature configuration.",
              detail: "Creating the chapter is what lets its members and leaders be added and start operating.",
              link: { label: "Create a chapter", href: "/admin/chapters/new" },
            },
            {
              action: "Review and edit **existing chapters** from the chapters list.",
              link: { label: "Manage chapters", href: "/admin/chapters" },
            },
            {
              action: "**Invite admins and users** and assign their roles.",
              detail: "Set up each new chapter's chair and core team so they can run it.",
              link: { label: "Invite a user", href: "/admin/users/invite" },
            },
          ],
        },
        {
          id: "hub",
          title: "National command center",
          steps: [
            {
              action: "Open the **national hub** for a cross-chapter view.",
              link: { label: "Open national", href: "/national" },
            },
          ],
        },
        {
          id: "benchmark",
          title: "Benchmark & compare chapters",
          steps: [
            {
              action: "Compare chapters with **benchmarks**.",
              link: { label: "Open benchmarks", href: "/national/benchmarks" },
            },
            {
              action: "Review **national events** across chapters.",
              link: { label: "Open national events", href: "/national/events" },
            },
          ],
        },
        {
          id: "broadcast",
          title: "Broadcast & sync",
          steps: [
            {
              action: "Send a **broadcast** to chapters.",
              link: { label: "Open broadcasts", href: "/national/broadcasts" },
            },
            {
              action: "Run **data sync** between chapters and national systems, and adjust national settings.",
              link: { label: "Open sync", href: "/national/sync" },
            },
          ],
        },
        {
          id: "oversight",
          title: "Oversee awards & succession",
          steps: [
            {
              action: "Review nominations as a **Take Pride jury** member.",
              link: { label: "Open jury review", href: "/awards/jury" },
            },
            {
              action: "Oversee the **succession & leadership** process.",
              link: { label: "Open succession admin", href: "/succession/admin" },
            },
          ],
        },
        HELP_SECTION,
      ],
    },
  },

  glossary: [
    { term: "Membership request", def: "A new person's application to join the chapter — a leader approves it before the person can sign in." },
    { term: "Chapter onboarding", def: "Setting up a new chapter (creating it, then adding its chair, core team and members) so it can start operating." },
    { term: "Engagement score", def: "A member's activity level — from event attendance, committee work, volunteering and profile completeness." },
    { term: "Health score", def: "How strong a stakeholder relationship is — based on recent interactions, collaborations and contact frequency." },
    { term: "RSVP", def: "Registering whether you will attend an event, so organisers can plan." },
    { term: "Vertical", def: "A focus area of the chapter (a program track) with its own dashboard, KPIs and head." },
    { term: "KPI", def: "Key Performance Indicator — a measure (like events held or members engaged) that tracks progress against a target." },
    { term: "Take Pride", def: "Yi's recognition awards — nominate members, a jury scores them, winners appear on the leaderboard." },
    { term: "Pathfinder / Health card", def: "The chapter's activity plan and the card that tracks delivery against it." },
    { term: "Succession", def: "The leadership pipeline — nominating, evaluating and selecting the next set of leaders." },
    { term: "Reimbursement", def: "Getting back money you spent for Yi — submit the expense with a receipt, then it is approved and paid." },
  ],

  plannedLocaleNote: "A Tamil version is planned — English only for now.",
};
