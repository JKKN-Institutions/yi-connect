/**
 * YIP page registry — the "navigate somewhere" half of global search.
 *
 * WHY THIS EXISTS
 * The other search groups answer "find me this RECORD". This one answers "take
 * me to that SCREEN", the way a command menu does: type "alloc", get
 * "Allocation", press enter, land on the page. YIP has ~90 screens spread over
 * four lanes and nobody memorises the URLs, so without this the palette is only
 * half a navigator.
 *
 * WHY IT IS A HAND-WRITTEN LIST AND NOT A FILESYSTEM WALK
 * Route files are not addressable by themselves — `events/[id]/allocation`
 * needs an event id, `me/pm` only exists for one delegate, and the label a
 * person types ("seating") is rarely the folder name ("allocation"). Every
 * entry below was derived by listing `app/yip/**` and confirming a `page.tsx`
 * exists at that path; if you add a route, add it here too or it stays
 * unfindable.
 *
 * THE SAFETY BOUNDARY: `viewers`
 * A page entry is a hint about the shape of the app, and hints leak. A student
 * who is offered "Scoring Grid" learns that such a screen exists and that it is
 * one click away; a juror offered "Participants" learns there is a named
 * roster. So each entry declares exactly which kinds of person may be offered
 * it at all, and the four lanes never cross:
 *
 *   dashboard/* + /yip/regional → staff only
 *   /yip/me/*                   → participant only
 *   /yip/jury/*                 → jury only
 *   /yip/volunteer/*            → volunteer only
 *
 * The one shared entry is `/yip/guide`, which is deliberately built for all
 * four lanes and detects the viewer itself.
 *
 * WHAT THIS FILE IS *NOT*
 * It is not an authorization check. Offering "Rubrics" to a chapter organiser
 * does not grant it — `requireSuperAdmin()` on that page still renders
 * Forbidden403. The `viewers` field is the coarse lane boundary (a student must
 * never be pointed at a dashboard route); the page itself remains the gate for
 * fine-grained staff tiers, because this module is pure and cannot ask the
 * database who anybody is.
 *
 * PURITY
 * No "use server", no imports beyond the shared types, no async, no I/O. Both
 * the server action and the client palette import it, so it has to be safe in
 * either runtime.
 */

import {
  SEARCH_GROUP_LIMIT,
  type SearchHit,
  type SearchViewer,
  type SearchViewerKind,
} from "./types";

/**
 * Event-scoped pages cannot produce a URL without an event id, so their href is
 * a builder rather than a string. Global pages are addressable as-is.
 */
export type YipPageHref = string | ((eventId: string) => string);

export type YipPageEntry = {
  /** What a human reads in the palette, and the primary thing they type. */
  label: string;
  /**
   * Synonyms someone might reach for instead of the label. These carry most of
   * the weight: people type "seating" for Allocation and "marks" for Scoring.
   */
  keywords: readonly string[];
  /** Static path, or a builder for pages living under `events/[id]`. */
  href: YipPageHref;
  /** "event" entries are skipped when no single event is in view. */
  scope: "event" | "global";
  /** Which lanes may be offered this page at all. See the header note. */
  viewers: readonly SearchViewerKind[];
  /** Second line in the palette — tells you which part of the app you land in. */
  section: string;
};

const STAFF: readonly SearchViewerKind[] = ["staff"] as const;
const PARTICIPANT: readonly SearchViewerKind[] = ["participant"] as const;
const JURY: readonly SearchViewerKind[] = ["jury"] as const;
const VOLUNTEER: readonly SearchViewerKind[] = ["volunteer"] as const;

/** Build an `events/[id]/…` href. Keeps the 36 event entries free of typos. */
const ev =
  (suffix: string) =>
  (eventId: string): string =>
    `/yip/dashboard/events/${eventId}${suffix}`;

/* ──────────────────────────────────────────────────────────────────────────
 * Staff — event-scoped (app/yip/dashboard/events/[id]/…)
 * ────────────────────────────────────────────────────────────────────────── */

const EVENT_PAGES: readonly YipPageEntry[] = [
  {
    label: "Event Overview",
    keywords: ["event", "overview", "home", "summary", "dashboard"],
    href: ev(""),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Agenda",
    keywords: ["agenda", "sessions", "schedule", "running order", "programme"],
    href: ev("/agenda"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Allocation",
    keywords: [
      "allocation",
      "allot",
      "seating",
      "seats",
      "assign",
      "constituency",
      "committee allocation",
    ],
    href: ev("/allocation"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Awards",
    keywords: ["awards", "prizes", "recognition", "best delegate"],
    href: ev("/awards"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Bills",
    keywords: ["bills", "legislation", "acts", "draft bill"],
    href: ev("/bills"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Cabinet",
    keywords: ["cabinet", "ministers", "ministries", "portfolio", "treasury"],
    href: ev("/cabinet"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Certificates",
    keywords: ["certificates", "certificate", "participation", "print"],
    href: ev("/certificates"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Chat",
    keywords: ["chat", "messages", "announcements", "broadcast"],
    href: ev("/chat"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Checklist",
    keywords: ["checklist", "tasks", "todo", "readiness", "prep"],
    href: ev("/checklist"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Control Room",
    keywords: [
      "control",
      "control room",
      "live",
      "run the day",
      "now speaking",
      "timer",
    ],
    href: ev("/control"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Edit Event",
    keywords: ["edit", "settings", "event settings", "rename", "dates"],
    href: ev("/edit"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Feedback",
    keywords: ["feedback", "responses", "survey"],
    href: ev("/feedback"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Organiser Feedback",
    keywords: ["organiser feedback", "organizer feedback", "team feedback"],
    href: ev("/feedback/organizer"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Feedback Report",
    keywords: ["feedback report", "survey report", "sentiment"],
    href: ev("/feedback/report"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Formation",
    keywords: [
      "formation",
      "elections",
      "speaker election",
      "party leader",
      "government formation",
    ],
    href: ev("/formation"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Formation Announcement",
    keywords: ["formation announcement", "announce results", "declare"],
    href: ev("/formation/announcement"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Jury",
    keywords: ["jury", "jurors", "judges", "panel", "experts"],
    href: ev("/jury"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Jury Sessions",
    keywords: ["jury sessions", "jury allocation", "who marks what", "benches"],
    href: ev("/jury/sessions"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Media",
    keywords: ["media", "photos", "gallery", "press", "images"],
    href: ev("/media"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Motions",
    keywords: ["motions", "resolutions", "adjournment"],
    href: ev("/motions"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Nominations",
    keywords: ["nominations", "nominate", "self nomination", "candidates"],
    href: ev("/nominations"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Participants",
    keywords: [
      "participants",
      "delegates",
      "students",
      "roster",
      "members",
      "import",
    ],
    href: ev("/participants"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Parties",
    keywords: ["parties", "party", "ruling", "opposition", "coalition"],
    href: ev("/parties"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Positions",
    keywords: [
      "positions",
      "roles",
      "office bearers",
      "pm",
      "prime minister",
      "speaker",
    ],
    href: ev("/positions"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Questionnaire",
    keywords: ["questionnaire", "selection paper", "test", "exam", "marking"],
    href: ev("/questionnaire"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Questions",
    keywords: ["questions", "question hour", "qh", "starred"],
    href: ev("/questions"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Order Paper",
    keywords: ["order paper", "question order", "list of business"],
    href: ev("/questions/order-paper"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Event Report",
    keywords: ["report", "post event report", "writeup", "summary report"],
    href: ev("/report"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Results",
    keywords: ["results", "leaderboard", "ranking", "winners", "standings"],
    href: ev("/results"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Scoring",
    keywords: ["scoring", "scores", "marks", "marking", "judging"],
    href: ev("/scoring"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Scoring Grid",
    keywords: ["scoring grid", "grid", "matrix", "all scores"],
    href: ev("/scoring-grid"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Speeches",
    keywords: ["speeches", "speaking", "debate", "speakers list"],
    href: ev("/speeches"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Event Team",
    keywords: ["team", "organisers", "organizers", "volunteers team", "staff"],
    href: ev("/team"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Topics",
    keywords: ["topics", "committee topics", "agenda topics", "subjects"],
    href: ev("/topics"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Volunteers",
    keywords: ["volunteers", "helpers", "stations", "crew"],
    href: ev("/volunteers"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
  {
    label: "Yuva",
    keywords: ["yuva", "youth academy", "mentors"],
    href: ev("/yuva"),
    scope: "event",
    viewers: STAFF,
    section: "This event",
  },
] as const;

/* ──────────────────────────────────────────────────────────────────────────
 * Staff — global (not tied to one event)
 * ────────────────────────────────────────────────────────────────────────── */

const STAFF_GLOBAL_PAGES: readonly YipPageEntry[] = [
  {
    label: "Dashboard",
    keywords: ["dashboard", "home", "events", "my events", "all events"],
    href: "/yip/dashboard",
    scope: "global",
    viewers: STAFF,
    section: "YIP",
  },
  {
    label: "New Event",
    keywords: ["new event", "create event", "add event", "start event"],
    href: "/yip/dashboard/events/new",
    scope: "global",
    viewers: STAFF,
    section: "YIP",
  },
  {
    label: "Scoring Guide",
    keywords: ["scoring guide", "how scoring works", "rubric guide", "help"],
    href: "/yip/dashboard/scoring-guide",
    scope: "global",
    viewers: STAFF,
    section: "YIP",
  },
  {
    label: "Topic Catalogue",
    keywords: ["topic catalogue", "topic catalog", "topics library", "topics"],
    href: "/yip/dashboard/topics",
    scope: "global",
    viewers: STAFF,
    section: "YIP",
  },
  {
    label: "Zones",
    keywords: ["zones", "regions", "zone summary", "regional"],
    href: "/yip/dashboard/zones",
    scope: "global",
    viewers: STAFF,
    section: "YIP",
  },
  {
    label: "Regional Overview",
    keywords: ["regional", "national footprint", "zones overview", "coverage"],
    href: "/yip/regional",
    scope: "global",
    viewers: STAFF,
    section: "YIP",
  },
] as const;

/* ──────────────────────────────────────────────────────────────────────────
 * Staff — platform master data (app/yip/dashboard/admin/…)
 *
 * These are `requireSuperAdmin()` pages. They are listed for "staff" because
 * this module cannot resolve a staff member's tier without a database call, and
 * a route name is not the secret — the page renders Forbidden403 to anyone
 * below super-admin. If a tighter viewer kind is ever added to SearchViewerKind
 * (e.g. "super_admin"), narrow these first.
 * ────────────────────────────────────────────────────────────────────────── */

const ADMIN_PAGES: readonly YipPageEntry[] = [
  {
    label: "Admin",
    keywords: ["admin", "administration", "master data", "settings"],
    href: "/yip/dashboard/admin",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "Agenda Templates",
    keywords: ["agenda templates", "session templates", "default agenda"],
    href: "/yip/dashboard/admin/agenda",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "Audit Log",
    keywords: ["audit log", "audit", "history", "who changed what", "trail"],
    href: "/yip/dashboard/admin/audit-log",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "Award Catalogue",
    keywords: ["award catalogue", "award types", "awards master"],
    href: "/yip/dashboard/admin/awards",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "Branding Rules",
    keywords: ["branding", "branding rules", "logos", "sponsors", "thalir"],
    href: "/yip/dashboard/admin/branding-rules",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "Chapter Admins",
    keywords: ["chapter admins", "chairs", "chapter chair", "access"],
    href: "/yip/dashboard/admin/chapter-admins",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "Checklist Templates",
    keywords: ["checklist templates", "default checklist", "task templates"],
    href: "/yip/dashboard/admin/checklist",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "Coverage",
    keywords: ["coverage", "chapter coverage", "who has run yip", "adoption"],
    href: "/yip/dashboard/admin/coverage",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "Mock Data",
    keywords: ["mock data", "demo data", "seed", "test data", "sandbox"],
    href: "/yip/dashboard/admin/mock-data",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "National",
    keywords: ["national", "national admins", "national intelligence"],
    href: "/yip/dashboard/admin/national",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "People",
    keywords: ["people", "directory", "yi directory", "profiles", "careers"],
    href: "/yip/dashboard/admin/people",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "Pipeline",
    keywords: ["pipeline", "promotions", "progression", "chapter to regional"],
    href: "/yip/dashboard/admin/pipeline",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "Privacy",
    keywords: ["privacy", "pii", "data protection", "consent"],
    href: "/yip/dashboard/admin/privacy",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "Rubrics",
    keywords: ["rubrics", "rubric", "criteria", "scoring criteria"],
    href: "/yip/dashboard/admin/rubrics",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "Scoring Config",
    keywords: ["scoring config", "weights", "position bonus", "score setup"],
    href: "/yip/dashboard/admin/scoring-config",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "Scoring Framework",
    keywords: ["scoring framework", "framework", "model", "scoring model"],
    href: "/yip/dashboard/admin/scoring-framework",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "Scoring Rules",
    keywords: ["scoring rules", "rules", "penalties", "bonus rules"],
    href: "/yip/dashboard/admin/scoring-rules",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "Seasons",
    keywords: ["seasons", "season", "yi year", "editions"],
    href: "/yip/dashboard/admin/seasons",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "Session Parameters",
    keywords: [
      "session parameters",
      "parameters",
      "criteria keys",
      "session setup",
    ],
    href: "/yip/dashboard/admin/session-parameters",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "Taxonomy",
    keywords: ["taxonomy", "government taxonomy", "ministries master", "gov"],
    href: "/yip/dashboard/admin/taxonomy",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "Admin Team",
    keywords: ["admin team", "platform team", "super admins"],
    href: "/yip/dashboard/admin/team",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
  {
    label: "Admin Topics",
    keywords: ["admin topics", "topic master", "topic library"],
    href: "/yip/dashboard/admin/topics",
    scope: "global",
    viewers: STAFF,
    section: "Admin",
  },
] as const;

/* ──────────────────────────────────────────────────────────────────────────
 * Participants (app/yip/me/…)
 *
 * Every one of these is the delegate's OWN view of their own event. None of
 * them points anywhere near dashboard/*. Several (PM, Speaker, Opposition,
 * Shadow, Ministry) only render for the delegate holding that role — offering
 * them to every student is harmless (they see their own empty-state) and
 * cheaper than resolving roles in a pure module.
 * ────────────────────────────────────────────────────────────────────────── */

const PARTICIPANT_PAGES: readonly YipPageEntry[] = [
  {
    label: "My Dashboard",
    keywords: ["me", "my dashboard", "home", "my page", "my event"],
    href: "/yip/me",
    scope: "global",
    viewers: PARTICIPANT,
    section: "My YIP",
  },
  {
    label: "My Bill",
    keywords: ["bill", "my bill", "legislation", "draft"],
    href: "/yip/me/bill",
    scope: "global",
    viewers: PARTICIPANT,
    section: "My YIP",
  },
  {
    label: "Chat",
    keywords: ["chat", "messages", "announcements"],
    href: "/yip/me/chat",
    scope: "global",
    viewers: PARTICIPANT,
    section: "My YIP",
  },
  {
    label: "My Committee",
    keywords: ["committee", "my committee", "group", "ministry group"],
    href: "/yip/me/committee",
    scope: "global",
    viewers: PARTICIPANT,
    section: "My YIP",
  },
  {
    label: "Feedback",
    keywords: ["feedback", "survey", "rate the event"],
    href: "/yip/me/feedback",
    scope: "global",
    viewers: PARTICIPANT,
    section: "My YIP",
  },
  {
    label: "My Journey",
    keywords: ["journey", "my journey", "progress", "history", "career"],
    href: "/yip/me/journey",
    scope: "global",
    viewers: PARTICIPANT,
    section: "My YIP",
  },
  {
    label: "Learn",
    keywords: ["learn", "training", "prepare", "how it works", "coaching"],
    href: "/yip/me/learn",
    scope: "global",
    viewers: PARTICIPANT,
    section: "My YIP",
  },
  {
    label: "My Ministry",
    keywords: ["ministry", "my ministry", "portfolio", "department"],
    href: "/yip/me/ministry",
    scope: "global",
    viewers: PARTICIPANT,
    section: "My YIP",
  },
  {
    label: "My Motion",
    keywords: ["motion", "my motion", "resolution"],
    href: "/yip/me/motion",
    scope: "global",
    viewers: PARTICIPANT,
    section: "My YIP",
  },
  {
    label: "Nominate",
    keywords: ["nominate", "nomination", "stand for election", "candidate"],
    href: "/yip/me/nominate",
    scope: "global",
    viewers: PARTICIPANT,
    section: "My YIP",
  },
  {
    label: "Opposition",
    keywords: ["opposition", "opposition leader", "shadow side"],
    href: "/yip/me/opposition",
    scope: "global",
    viewers: PARTICIPANT,
    section: "My YIP",
  },
  {
    label: "Prime Minister",
    keywords: ["pm", "prime minister", "cabinet", "government"],
    href: "/yip/me/pm",
    scope: "global",
    viewers: PARTICIPANT,
    section: "My YIP",
  },
  {
    label: "Questionnaire",
    keywords: ["questionnaire", "paper", "test", "selection paper", "exam"],
    href: "/yip/me/questionnaire",
    scope: "global",
    viewers: PARTICIPANT,
    section: "My YIP",
  },
  {
    label: "My Questions",
    keywords: ["questions", "my questions", "question hour", "ask"],
    href: "/yip/me/questions",
    scope: "global",
    viewers: PARTICIPANT,
    section: "My YIP",
  },
  {
    label: "My Report",
    keywords: ["report", "my report", "certificate", "takeaway"],
    href: "/yip/me/report",
    scope: "global",
    viewers: PARTICIPANT,
    section: "My YIP",
  },
  {
    label: "Shadow Cabinet",
    keywords: ["shadow", "shadow cabinet", "shadow minister"],
    href: "/yip/me/shadow",
    scope: "global",
    viewers: PARTICIPANT,
    section: "My YIP",
  },
  {
    label: "Speaker",
    keywords: ["speaker", "chair the house", "presiding"],
    href: "/yip/me/speaker",
    scope: "global",
    viewers: PARTICIPANT,
    section: "My YIP",
  },
  {
    label: "Vote",
    keywords: ["vote", "voting", "ballot", "election"],
    href: "/yip/me/vote",
    scope: "global",
    viewers: PARTICIPANT,
    section: "My YIP",
  },
] as const;

/* ──────────────────────────────────────────────────────────────────────────
 * Jury (app/yip/jury/(authed)/…)
 *
 * `(authed)` is a route group — it does not appear in the URL, so the folder
 * `jury/(authed)/committees` is served at `/yip/jury/committees`.
 * The login page is deliberately absent: a signed-in juror has no reason to be
 * offered it, and it is the one jury route reachable without a session.
 * ────────────────────────────────────────────────────────────────────────── */

const JURY_PAGES: readonly YipPageEntry[] = [
  {
    label: "Jury Dashboard",
    keywords: ["jury", "home", "my sessions", "scoring", "marking", "score"],
    href: "/yip/jury",
    scope: "global",
    viewers: JURY,
    section: "Jury",
  },
  {
    label: "Committees",
    keywords: ["committees", "committee", "groups", "rooms"],
    href: "/yip/jury/committees",
    scope: "global",
    viewers: JURY,
    section: "Jury",
  },
  {
    label: "History",
    keywords: ["history", "past scores", "submitted", "what i marked"],
    href: "/yip/jury/history",
    scope: "global",
    viewers: JURY,
    section: "Jury",
  },
] as const;

/* ──────────────────────────────────────────────────────────────────────────
 * Volunteers (app/yip/volunteer/…)
 * ────────────────────────────────────────────────────────────────────────── */

const VOLUNTEER_PAGES: readonly YipPageEntry[] = [
  {
    label: "Volunteer Dashboard",
    keywords: ["volunteer", "home", "my station", "duties"],
    href: "/yip/volunteer",
    scope: "global",
    viewers: VOLUNTEER,
    section: "Volunteer",
  },
  {
    label: "Now Speaking",
    keywords: ["now speaking", "speaking", "current speaker", "live", "queue"],
    href: "/yip/volunteer/now-speaking",
    scope: "global",
    viewers: VOLUNTEER,
    section: "Volunteer",
  },
] as const;

/* ──────────────────────────────────────────────────────────────────────────
 * Shared
 * ────────────────────────────────────────────────────────────────────────── */

const SHARED_PAGES: readonly YipPageEntry[] = [
  {
    // The only genuinely cross-lane page in YIP: it detects the viewer's lane
    // itself and renders that persona's guide, so all four kinds may be offered
    // the same href without any of them seeing another lane's content.
    label: "How to use the platform",
    keywords: ["guide", "help", "how to", "tutorial", "manual", "instructions"],
    href: "/yip/guide",
    scope: "global",
    viewers: ["staff", "jury", "participant", "volunteer"],
    section: "Help",
  },
] as const;

/** Every navigable page the palette may offer, in display order. */
export const YIP_PAGES: readonly YipPageEntry[] = [
  ...EVENT_PAGES,
  ...STAFF_GLOBAL_PAGES,
  ...ADMIN_PAGES,
  ...PARTICIPANT_PAGES,
  ...JURY_PAGES,
  ...VOLUNTEER_PAGES,
  ...SHARED_PAGES,
] as const;

/**
 * Which event an event-scoped href should be built against.
 *
 * Access-code sessions carry exactly one event, so `viewer.eventId` is the
 * answer whenever it is set. Staff never carry one, but a chapter organiser
 * whose whole scope is a single event has an unambiguous answer too, so we use
 * it. Anything else — a super-admin with "all", or staff scoped to several
 * events — returns null and the entry is dropped. We never pick an event for
 * someone: landing on the wrong event's Allocation page is worse than the
 * suggestion simply not appearing.
 */
function resolveViewerEventId(viewer: SearchViewer): string | null {
  if (viewer.eventId) return viewer.eventId;
  if (viewer.eventScope === "all") return null;
  if (viewer.eventScope.length === 1) return viewer.eventScope[0];
  return null;
}

/** Score a candidate so "alloc" ranks Allocation above anything that merely mentions it. */
function scoreEntry(entry: YipPageEntry, needle: string): number | null {
  const label = entry.label.toLowerCase();
  if (label === needle) return 0;
  if (label.startsWith(needle)) return 1;
  if (label.includes(needle)) return 2;

  let best: number | null = null;
  for (const keyword of entry.keywords) {
    const k = keyword.toLowerCase();
    if (k === needle) best = Math.min(best ?? 3, 3);
    else if (k.startsWith(needle)) best = Math.min(best ?? 4, 4);
    else if (k.includes(needle)) best = Math.min(best ?? 5, 5);
  }
  return best;
}

/**
 * Find pages this viewer may navigate to.
 *
 * Pure and synchronous: the caller (the search action) merges these with the
 * database-backed groups. Returns at most SEARCH_GROUP_LIMIT hits so the Pages
 * group cannot crowd out the concrete records above it in the palette.
 */
export function matchPages(query: string, viewer: SearchViewer): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];

  const eventId = resolveViewerEventId(viewer);

  const scored: Array<{ hit: SearchHit; rank: number }> = [];

  for (const entry of YIP_PAGES) {
    // The lane boundary. Checked before anything else so a mismatched viewer
    // never even reaches href construction.
    if (!entry.viewers.includes(viewer.kind)) continue;

    const rank = scoreEntry(entry, needle);
    if (rank === null) continue;

    let href: string;
    if (entry.scope === "event") {
      if (!eventId) continue; // no event in view — drop rather than guess
      href = typeof entry.href === "function" ? entry.href(eventId) : entry.href;
    } else {
      href =
        typeof entry.href === "function"
          ? entry.href(eventId ?? "")
          : entry.href;
    }

    scored.push({
      rank,
      hit: {
        group: "pages",
        // href is unique per entry, which makes this key stable across renders
        // and safe to de-duplicate on.
        id: `page:${href}`,
        title: entry.label,
        subtitle: entry.section,
        href,
      },
    });
  }

  scored.sort((a, b) => a.rank - b.rank || a.hit.title.localeCompare(b.hit.title));
  return scored.slice(0, SEARCH_GROUP_LIMIT).map((s) => s.hit);
}
