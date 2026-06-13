/**
 * Yi Youth Academy — "How to use the platform" guide content (single source).
 *
 * ONE smart guide that adapts to the viewer. This module is PURE DATA (strings
 * only — no JSX, no icons, no I/O) so the SAME content drives both renderers
 * without drift:
 *   - in-app:  app/youth-academy/_components/GuideView.tsx
 *   - PDF:     lib/yuva/guide/guide-pdf.tsx (downloadable / shareable)
 *
 * Writing rules (12th-grader friendly, locked with the user 2026-06-13):
 *   - one ACTION per step, plain verbs, no jargon
 *   - a short "journey" map per lane so the reader sees the whole arc at a glance
 *   - a clickable deep-link on every step that points at a real page, so the
 *     guide doubles as a launchpad (taps straight to the page it describes) —
 *     this is the durable "more intuitive" mechanism, no screenshots to rot
 *
 * Every step is grounded in the live flows + locked operating decisions
 * (docs/yi-youth-academy-spec.md and the project memory): National creates
 * academies + authors programs; chapters deliver (runs, applications, cohorts,
 * attendance, certificates); access codes are issued at COHORT FORMATION (not
 * per-acceptance); batches (runs) are fixed; students use an access code or a
 * one-time email code — no passwords.
 */

export const GUIDE_LANES = [
  "applicant",
  "student",
  "mentor",
  "coordinator",
  "chapter_admin",
  "national",
] as const;

export type GuideLane = (typeof GUIDE_LANES)[number];

/** A deep-link straight to the page (or section) a step refers to. */
export type GuideLink = { href: string; label: string };

/**
 * A screenshot for a step. Used ONLY for the 2-3 public, stable entry moments
 * (decision 2026-06-13) — capturing/maintaining shots of fast-moving authed
 * screens isn't worth the rot. Assets live in public/youth-academy/guide/.
 */
export type GuideImage = {
  src: string;
  alt: string;
  /** Intrinsic pixel size — drives aspect ratio in both renderers. */
  width: number;
  height: number;
};

export type GuideStep = {
  /** Imperative one-liner — the single thing to do. */
  action: string;
  /** One sentence of plain-language help (optional). */
  detail?: string;
  /** A highlighted tip / watch-out (optional). */
  tip?: string;
  /** "Take me there" link to the actual page this step describes (optional). */
  link?: GuideLink;
  /** A screenshot of this moment (optional — public/stable moments only). */
  image?: GuideImage;
};

const SHOT_LOGIN: GuideImage = {
  src: "/youth-academy/guide/login-students.png",
  alt: 'The "Students" sign-in box — enter your access code, or switch to "Email code".',
  width: 896,
  height: 624,
};
const SHOT_ACCEPTANCE: GuideImage = {
  src: "/youth-academy/guide/acceptance-code.png",
  alt: "The acceptance email — your 8-character access code is in the highlighted box.",
  width: 1172,
  height: 664,
};

export type GuideSection = {
  heading: string;
  steps: GuideStep[];
};

export type GuideFaq = { q: string; a: string };

export type GuideContent = {
  lane: GuideLane;
  /** Short label shown on chips / titles, e.g. "Student". */
  label: string;
  /** Who this lane is for — one line. */
  tagline: string;
  /** The whole arc as a few words each — rendered as a journey map. */
  journey: string[];
  sections: GuideSection[];
  faqs: GuideFaq[];
  /** Who to contact for help. */
  help: string;
};

const APPLICANT: GuideContent = {
  lane: "applicant",
  label: "Applying",
  tagline: "For students who want to join a Yi Youth Academy program.",
  journey: ["Find a program", "Apply", "Get confirmation", "Get accepted", "You're in"],
  sections: [
    {
      heading: "Find a program that fits you",
      steps: [
        {
          action: "Open the Yi Youth Academy home page.",
          detail: "You'll see every program that's currently open for applications.",
          link: { href: "/youth-academy", label: "Open the home page" },
        },
        {
          action: "Use the topic and city filters to narrow the list.",
          detail: "Each card shows the topic, the city, and the date applications close.",
        },
        {
          action: "Open a program to read what you'll learn and the schedule.",
        },
      ],
    },
    {
      heading: "Apply",
      steps: [
        { action: 'On the program page, tap "Apply".' },
        {
          action: "Fill in your name, email, phone, and why you want to join.",
          detail: "Keep your reason short and honest — two or three lines is plenty.",
        },
        {
          action: "Tick the consent box and submit.",
          tip: "Use an email you check often — your acceptance and access code come there.",
        },
      ],
    },
    {
      heading: "After you apply",
      steps: [
        {
          action: "Look for the confirmation email — it arrives right away.",
          detail: "This means we received your application. It does not mean you're accepted yet.",
        },
        {
          action: "Wait for the application window to close.",
          detail: "The chapter team reviews everyone's applications after applications close.",
        },
        {
          action: "Watch for your acceptance email with an 8-character access code.",
          detail: "Codes are sent when your batch (cohort) is formed — that's your key to sign in.",
          tip: "Once you have the code, use the Student guide to sign in and get started.",
          image: SHOT_ACCEPTANCE,
        },
      ],
    },
  ],
  faqs: [
    {
      q: "I didn't get any email.",
      a: "Check your spam folder. The confirmation is instant; the acceptance email only comes after the application window closes and your batch is formed.",
    },
    {
      q: "Do I need to create an account or a password?",
      a: "No. Students sign in with the access code from the acceptance email — or a one-time code sent to your email. There's no password to remember.",
    },
  ],
  help: "Reach out to your chapter's Yi Youth Academy team — the contact is in your confirmation email.",
};

const STUDENT: GuideContent = {
  lane: "student",
  label: "Student",
  tagline: "For accepted students taking part in a program.",
  journey: ["Get your code", "Sign in", "Attend sessions", "Submit your work", "Get your certificate"],
  sections: [
    {
      heading: "Sign in",
      steps: [
        {
          action: "Open your acceptance email and find your 8-character access code.",
          image: SHOT_ACCEPTANCE,
        },
        {
          action: 'Go to the Sign in page and choose the "Students" box.',
          link: { href: "/youth-academy/login", label: "Go to Sign in" },
          image: SHOT_LOGIN,
        },
        {
          action: "Type your code and open your portal.",
          tip: 'Lost your code? Switch to "Email code", enter your email, and we\'ll send a fresh one-time code.',
        },
      ],
    },
    {
      heading: "Find your program",
      steps: [
        {
          action: 'Open "My programs" — your batch and its sessions are listed there.',
          link: { href: "/youth-academy/me", label: "Open My programs" },
        },
        {
          action: "Open a session to see the date, the venue, and what to prepare.",
        },
      ],
    },
    {
      heading: "Attend & submit your work",
      steps: [
        {
          action: "Show up to each session — your mentor marks who attended.",
          detail: "Attendance is part of what unlocks your certificate.",
        },
        {
          action: 'When a session asks for work, upload it under "My work".',
          detail: "Some sessions expect a small piece of work — an idea, a plan, a pitch.",
          link: { href: "/youth-academy/me/work", label: "Open My work" },
        },
        {
          action: 'Use "Messages" to reach your mentor and your batch.',
          link: { href: "/youth-academy/me/messages", label: "Open Messages" },
        },
      ],
    },
    {
      heading: "Get your certificate",
      steps: [
        {
          action: `When you've attended enough sessions and submitted the required work, open "Certificate".`,
          detail: "Your certificate unlocks automatically once you meet the requirements.",
          link: { href: "/youth-academy/me/certificate", label: "Open Certificate" },
        },
        {
          action: "Download it as a PDF to keep and share.",
        },
      ],
    },
  ],
  faqs: [
    {
      q: "What if I miss a session?",
      a: "Tell your mentor through Messages. Your attendance and the required work together decide your certificate, so don't fall behind quietly.",
    },
    {
      q: "Can I move to a different batch?",
      a: "No — batches are fixed once they're formed. You stay in the batch you were accepted into.",
    },
  ],
  help: "Message your mentor inside the portal, or contact your chapter's Yi Youth Academy team.",
};

const MENTOR: GuideContent = {
  lane: "mentor",
  label: "Mentor",
  tagline: "For mentors guiding the sessions of a batch.",
  journey: ["Sign in", "Open your cohort", "Run each session", "Mark attendance", "Review student work"],
  sections: [
    {
      heading: "Sign in",
      steps: [
        {
          action: 'Go to the Sign in page and use "Continue with Google" with your Yi account.',
          detail: "You can also use your email and password if you have one.",
          link: { href: "/youth-academy/login", label: "Go to Sign in" },
        },
        {
          action: "Land in your Mentor area — it shows the batches you're assigned to.",
          link: { href: "/youth-academy/mentor", label: "Open Mentor dashboard" },
        },
      ],
    },
    {
      heading: "Your cohorts & sessions",
      steps: [
        { action: "Open a cohort to see its sessions and the student roster." },
        {
          action: "Open a session to see the date, venue, learning objective, and materials.",
        },
      ],
    },
    {
      heading: "Run a session",
      steps: [
        { action: "Share the session materials with the students from the session page." },
        {
          action: "Mark attendance for who showed up.",
          detail: "Attendance feeds each student's certificate eligibility, so mark it the same day.",
        },
      ],
    },
    {
      heading: "Review student work",
      steps: [
        {
          action: "For sessions that expect a submission, review what students uploaded.",
        },
        { action: "Use Messages to give feedback and answer questions." },
      ],
    },
  ],
  faqs: [
    {
      q: "I don't see a cohort or session.",
      a: "You only see the sessions you're assigned to. Ask the chapter admin who set up the run to assign you.",
    },
    {
      q: "Can I change the program content?",
      a: "No — programs are authored by the National team. Your job is to deliver the sessions well.",
    },
  ],
  help: "Contact the chapter admin who set up the run.",
};

const COORDINATOR: GuideContent = {
  lane: "coordinator",
  label: "Institution coordinator",
  tagline: "For institution coordinators running their academy's batches.",
  journey: ["Open your runs", "Schedule sessions", "Track attendance & work", "Support certificates"],
  sections: [
    {
      heading: "What you manage",
      steps: [
        {
          action: "Focus on the batches (runs) of your academy.",
          detail: "You co-manage scheduling, cohorts, sessions, attendance and submissions for your academy's runs.",
        },
        {
          action: "Leave the academy record and the mentor network to the chapter and National.",
          tip: "Those are managed for you — you concentrate on running the batches.",
        },
      ],
    },
    {
      heading: "Deliver the batches",
      steps: [
        {
          action: `Open "Runs" to see your academy's batches.`,
          link: { href: "/youth-academy/chapter/runs", label: "Open Runs" },
        },
        {
          action: "Help schedule each session, keep attendance up to date, and keep submissions moving.",
        },
        {
          action: "When students complete the requirements, their certificates become available.",
        },
      ],
    },
  ],
  faqs: [
    {
      q: "Why can't I add mentors or edit the academy?",
      a: "Those stay with the chapter and the National team. Your lane is delivering the batches — scheduling, attendance and student work.",
    },
  ],
  help: "Contact your chapter admin or the National team.",
};

const CHAPTER_ADMIN: GuideContent = {
  lane: "chapter_admin",
  label: "Chapter admin",
  tagline: "For the chapter's Yi Youth Academy lead.",
  journey: ["Your academy", "Schedule a run", "Open applications", "Form the cohort", "Deliver", "Certificates"],
  sections: [
    {
      heading: "Your academy & mentors",
      steps: [
        {
          action: `Open "Academies" to see your chapter's academy.`,
          detail: "The academy itself is created by National — you deliver programs through it.",
          link: { href: "/youth-academy/chapter/academies", label: "Open Academies" },
        },
        {
          action: `Add your mentors under "Mentors" to build the chapter's mentor network.`,
          link: { href: "/youth-academy/chapter/mentors", label: "Open Mentors" },
        },
      ],
    },
    {
      heading: "Schedule a run (a batch of a program)",
      steps: [
        {
          action: `Go to "Runs" → "New run" and pick a National program.`,
          link: { href: "/youth-academy/chapter/runs/new", label: "Start a new run" },
        },
        {
          action: "Set the dates, capacity, application window, and the cohort announcement date.",
        },
        {
          action: "Publish the run.",
          detail: "Once published, it appears on the public site for students to apply.",
        },
      ],
    },
    {
      heading: "Applications & cohort",
      steps: [
        {
          action: `When applications close, open the run's "Applications" to review and accept students.`,
          link: { href: "/youth-academy/chapter/runs", label: "Open Runs" },
        },
        {
          action: "Form the cohort.",
          detail: "Access codes go out to accepted students at this point — when the cohort is formed, not the moment you accept them.",
          tip: "A code didn't arrive? Re-check the student's email on their application, then resend from the cohort page.",
        },
      ],
    },
    {
      heading: "Deliver & certify",
      steps: [
        { action: "Schedule each session, assign a mentor, and set the venue." },
        { action: "Track attendance and student work through the run." },
        {
          action: "When students complete the requirements, certificates become available to them.",
        },
      ],
    },
  ],
  faqs: [
    {
      q: "Can I create a program or a new academy?",
      a: "No — programs and academies are created by the National team. You schedule and run them through your chapter's academy.",
    },
  ],
  help: "Contact the National team for academy or program changes.",
};

const NATIONAL: GuideContent = {
  lane: "national",
  label: "National",
  tagline: "For the Yi YUVA national team that runs the whole platform.",
  journey: ["Create academies", "Author programs", "Oversee delivery", "Monitor & export"],
  sections: [
    {
      heading: "Academies",
      steps: [
        {
          action: `Open "Academies" → "New academy" to set up a chapter's academy.`,
          detail: "Creating an academy IS its approval — there is no separate sign-off step. Upload the academy logo here.",
          link: { href: "/youth-academy/national/academies/new", label: "Create an academy" },
        },
        {
          action: "Bind an institution coordinator to the academy if there is one.",
          link: { href: "/youth-academy/national/academies", label: "Open Academies" },
        },
      ],
    },
    {
      heading: "Programs",
      steps: [
        {
          action: `Open "Programs" → "New program" and author it with the template.`,
          detail: "Part A: national overview. Part B: chapter delivery notes. Part C: the sessions, with documents and learning objectives.",
          link: { href: "/youth-academy/national/programs/new", label: "Create a program" },
        },
        {
          action: "Only National authors programs — chapters deliver them.",
        },
      ],
    },
    {
      heading: "Oversight",
      steps: [
        {
          action: "See every chapter's academies and runs across the country.",
          link: { href: "/youth-academy/national", label: "Open dashboard" },
        },
        {
          action: "Use the compliance and quarterly views to monitor delivery and export reports.",
        },
      ],
    },
  ],
  faqs: [
    {
      q: "Quick reminder — who can do what?",
      a: "National manages everything; chapters deliver; institution coordinators run their academy's batches; mentors run the sessions; students attend and submit.",
    },
  ],
  help: "You sit at the top of the chain. For platform-level role and directory changes, the platform super-admin manages the people directory.",
};

export const GUIDES: Record<GuideLane, GuideContent> = {
  applicant: APPLICANT,
  student: STUDENT,
  mentor: MENTOR,
  coordinator: COORDINATOR,
  chapter_admin: CHAPTER_ADMIN,
  national: NATIONAL,
};

/** Friendly download filename per lane, e.g. "Yi-Youth-Academy-Student-Guide.pdf". */
export function guidePdfFilename(lane: GuideLane): string {
  const slug = GUIDES[lane].label.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `Yi-Youth-Academy-${slug}-Guide.pdf`;
}

/** Type guard for an untrusted ?lane= query value. */
export function isGuideLane(v: string | null | undefined): v is GuideLane {
  return !!v && (GUIDE_LANES as readonly string[]).includes(v);
}
