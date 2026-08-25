/**
 * YIQ in-app guide — the content, as pure data.
 *
 * Mirrors lib/yip/guide and lib/yi-future/guide: strings only, no JSX and no
 * I/O, so the same model can drive a page, a drawer or a printed sheet without
 * the three drifting apart. The types live here too rather than in a sibling
 * types.ts — this guide is small enough that one file is the whole contract.
 *
 * FOUR AUDIENCES, DELIBERATELY NOT MIXED
 *   student    a 14-to-18-year-old on a phone, signing in with a 6-char code
 *   teacher    registers 2-3 students from one school, gets the codes once
 *   organiser  runs a chapter: registration, the online round, the finals
 *   national   owns the question bank, the papers, and the national ladder
 *
 * EVERY CLAIM BELOW IS READ OFF THE SHIPPED CODE, not off a brief. The
 * load-bearing sources, for whoever edits this next:
 *   lib/yiq/constants.ts        categories, team size, the six finals rounds,
 *                               the eight chapter-event statuses
 *   lib/yiq/scoring.ts          team score = SUM of members, ties on total
 *                               time, Best Individual Quizzer
 *   lib/yiq/registration.ts     2-3 members, one category per team, caps
 *   lib/yiq/access-code.ts      6-char student code, unambiguous alphabet
 *   lib/yiq/paper.ts            the server-authoritative clock
 *   lib/yiq/review.ts           when an answer key may be revealed
 *   lib/yiq/question-pools.ts   practice questions never reach a scored paper
 *   lib/yiq/national.ts         the derived Quarter/Semi/Final ladder
 *   lib/yiq/roles.ts            what each YIQ role can and cannot do
 *   app/yiq/actions/*.ts        the server actions each step describes
 *
 * If you change a rule in one of those files, change the sentence here in the
 * same commit. A guide that is confidently wrong is worse than no guide.
 */

/* ── Model ─────────────────────────────────────────────────────────────── */

export type YiqGuideAudience = "student" | "teacher" | "organiser" | "national";

/** A "Take me there" button on a single step. */
export interface YiqGuideLink {
  label: string;
  href: string;
}

export interface YiqGuideStep {
  /** The one thing to do, as a short imperative or statement. */
  action: string;
  /** One or two plain sentences of help. */
  detail?: string;
  /** A watch-out worth setting apart from the detail. */
  tip?: string;
  link?: YiqGuideLink;
}

export interface YiqGuideSection {
  /** Stable kebab-case anchor id. */
  id: string;
  title: string;
  steps: YiqGuideStep[];
}

/** A question this audience actually asks, with the honest answer. */
export interface YiqGuideAnswer {
  q: string;
  a: string;
}

export interface YiqAudienceGuide {
  audience: YiqGuideAudience;
  /** Short label for the audience switch. */
  label: string;
  /** The page headline for this lane. */
  title: string;
  /** One line: what this person does. */
  tagline: string;
  /** Who this lane is for, so a reader can tell they are in the wrong one. */
  whoFor: string;
  /** The whole arc in a few short phrases. */
  journey: string[];
  sections: YiqGuideSection[];
  answers?: YiqGuideAnswer[];
}

export type YiqGuideBook = Record<YiqGuideAudience, YiqAudienceGuide>;

export const YIQ_GUIDE_AUDIENCES: readonly YiqGuideAudience[] = [
  "student",
  "teacher",
  "organiser",
  "national",
] as const;

/** Type guard for an untrusted `?for=` query value. */
export function isYiqGuideAudience(
  v: string | null | undefined
): v is YiqGuideAudience {
  return (
    v === "student" || v === "teacher" || v === "organiser" || v === "national"
  );
}

export interface YiqGlossaryEntry {
  term: string;
  means: string;
}

/* ── Words to know ─────────────────────────────────────────────────────── */

export const YIQ_GLOSSARY: readonly YiqGlossaryEntry[] = [
  {
    term: "Chapter",
    means:
      "The local Young Indians unit running YIQ in your city. Every team belongs to one chapter, and each chapter runs its own dates.",
  },
  {
    term: "Category",
    means:
      "Junior is Classes 9 and 10. Senior is Classes 11 and 12. They are two separate championships that never score against each other.",
  },
  {
    term: "Access code",
    means:
      "The six characters a student signs in with. There is no password and no email sign-in. Each student has their own code.",
  },
  {
    term: "Team code",
    means:
      "One code per team, shown on the registration confirmation screen and on each member's own page. It is the team's reference, not a sign-in.",
  },
  {
    term: "Online round",
    means:
      "The timed paper each student sits on their own device. One attempt per student, ever. It decides which teams reach the Chapter Finals.",
  },
  {
    term: "Practice quiz",
    means:
      "A paper built the same way as the real one, from a separate set of questions. Unlimited goes. It never counts towards anything.",
  },
  {
    term: "Standings",
    means:
      "The ranked list of teams in a category after the online round, once the chapter has published it.",
  },
  {
    term: "Qualifying count",
    means:
      "How many teams from the online round go on stage at the Chapter Finals. Ten unless the chapter's event was set to another number.",
  },
  {
    term: "Chapter Finals",
    means:
      "Six live on-stage rounds — Direct, Pass-On, Visual, Audio, Rapid Fire and the India Challenge — run from an organiser's console.",
  },
  {
    term: "Best Individual Quizzer",
    means:
      "The highest single paper score in a category, recorded alongside the team standings.",
  },
  {
    term: "National Grand Finale",
    means:
      "The national ladder that every chapter champion team enters. Depending on how many teams enter, it runs a Quarter-Final, a Semi-Final and a Final, or fewer stages.",
  },
] as const;

/* ── The lanes ─────────────────────────────────────────────────────────── */

const STUDENT: YiqAudienceGuide = {
  audience: "student",
  label: "Student",
  title: "Your YIQ",
  tagline: "Sign in, practise, then sit one paper that counts.",
  whoFor:
    "You are in Class 9 to 12 and your teacher has entered your school team.",
  journey: [
    "Get your code",
    "Sign in",
    "Practise",
    "Sit the round",
    "Check your answers",
    "Chapter Finals",
  ],
  sections: [
    {
      id: "sign-in",
      title: "Sign in with your code",
      steps: [
        {
          action: "Get your six-character code from your teacher.",
          detail:
            "It comes from the screen your teacher saw right after they registered your team. Every student in the team has their own code.",
          tip: "Do not use a teammate's code. It signs you in as them, and their one attempt gets used up.",
        },
        {
          action: "Type the code on the sign-in page.",
          detail:
            "Spaces, dashes and small letters do not matter — they are cleaned up for you.",
          link: { label: "Sign in", href: "/yiq/login" },
        },
        {
          action: "Look twice at characters that look alike.",
          detail:
            "Codes never contain the letters B, I, L, O or S, and never the digits 0, 1, 5, 8 or 9. If you think you see one, it is the character it looks like.",
        },
        {
          action: 'If it says "That code didn\'t work", check for a typo, then ask your teacher.',
          detail:
            "The message is the same for a wrong code and a code that does not exist, so it is never telling you something about you.",
        },
      ],
    },
    {
      id: "practise",
      title: "Practise as much as you want",
      steps: [
        {
          action: "Open the practice quiz.",
          detail:
            "Same shape as the real paper: a question, four options, one right answer.",
          link: { label: "Start practising", href: "/yiq/quiz?mode=mock" },
        },
        {
          action: "Practice never counts.",
          detail:
            "Your practice score is not added to your team's total, so a bad run costs you nothing. Take it as many times as you like.",
        },
        {
          action: "Check your practice answers straight away.",
          detail:
            "Practice papers show you the correct answer as soon as you finish. That is the whole point of them.",
          link: { label: "Review my papers", href: "/yiq/me/review" },
        },
        {
          action: "Practising cannot show you the real paper.",
          detail:
            "Practice questions and the questions used in the round that counts are kept in separate sets on purpose.",
        },
        {
          action: "Read around seven topics.",
          detail:
            "India · Young India & Leadership · Business & Economics · Science & Technology · Current Affairs · Sports · Arts & Culture.",
        },
      ],
    },
    {
      id: "the-round",
      title: "The one round that counts",
      steps: [
        {
          action: "Wait for your chapter to open the round.",
          detail:
            'Your page says "Open now" when it is open, and shows the chapter\'s current stage when it is not.',
          link: { label: "My YIQ", href: "/yiq/me" },
        },
        {
          action: "You get one attempt. There is no second try.",
          detail:
            "Once you start, that is your paper. Sit down somewhere quiet, on a charged phone or laptop, with a signal you trust.",
        },
        {
          action: "The clock starts when you press Start and does not pause.",
          detail:
            "The time is kept on the server, not on your phone. Closing the app, reloading the page, or losing signal does not stop it and does not give you more time.",
          tip: "If your time runs out, the paper is submitted for you with whatever you have answered so far. Those answers still count.",
        },
        {
          action: "Answer what you know first, then come back.",
          detail:
            "A question you leave blank scores zero. It is never marked wrong, so leaving one is always safer than a wild guess when the paper takes marks off.",
        },
        {
          action: "Check whether your paper takes marks off for a wrong answer.",
          detail:
            "Some papers do and some do not — it is set per paper. Either way your total never goes below zero.",
        },
        {
          action: "Press submit when you are done.",
          detail:
            "Submitting twice is safe: your score is recorded once and cannot change afterwards.",
        },
      ],
    },
    {
      id: "after",
      title: "After you submit",
      steps: [
        {
          action: "Your answers stay hidden until your chapter closes the round.",
          detail:
            "Other students are still sitting the same paper. Once the chapter closes it, your paper opens question by question.",
          link: { label: "Review my papers", href: "/yiq/me/review" },
        },
        {
          action: "Your team's score is the average of everyone who sits. At least two of you must sit, or the team is out.",
          detail:
            "Not the average, and not the best one. A teammate who does not sit the paper adds zero, which pulls the team down.",
        },
        {
          action: "A tie goes to the faster team.",
          detail:
            "If two teams finish level on score, the one whose members took less time in total is ranked higher.",
        },
        {
          action: "Look for your chapter's published standings.",
          detail:
            "Results appear here as each chapter closes its round and publishes.",
          link: { label: "Chapter results", href: "/yiq/results" },
        },
      ],
    },
    {
      id: "finals",
      title: "If your team reaches the Chapter Finals",
      steps: [
        {
          action: "The top teams from the online round go on stage.",
          detail:
            "Ten teams per category unless your chapter set a different number.",
        },
        {
          action: "Six rounds, live, no devices.",
          detail:
            "Direct Questions · Pass-On · Visual · Audio · Rapid Fire · India Challenge. A quizmaster asks, your team answers out loud.",
        },
        {
          action: "A correct answer is worth 10 points.",
          detail:
            "In Pass-On, Visual, Audio and the India Challenge, a team that picks up a passed question earns a 5-point bonus. Direct Questions and Rapid Fire have no passing. Rapid Fire is 10 questions in 60 seconds.",
        },
        {
          action: "One champion team per category goes to the National Grand Finale.",
          detail:
            "Junior and Senior each crown their own champion, and each goes straight through to the national stage.",
        },
      ],
    },
  ],
  answers: [
    {
      q: "I lost my access code.",
      a: "Ask your teacher first — they saw every code on the confirmation screen when they registered the team, and that screen is the only time the app shows them. If nobody kept a copy, your chapter organiser has to help.",
    },
    {
      q: "My time ran out before I finished.",
      a: "The paper was submitted automatically with the answers you had already given. Those answers count normally. The questions you never reached score zero, not minus.",
    },
    {
      q: "Can I take the real round again?",
      a: "No. One attempt per student, ever. Practice is the unlimited one.",
    },
    {
      q: "A teammate did not sit the paper. Does it matter?",
      a: "Your score still counts. The team score is the average of whoever sits, so a teammate who misses it does not drag you down \u2014 but at least two of you must sit, or the team is out.",
    },
    {
      q: "I reloaded the page in the middle of the paper.",
      a: "You get the same paper back, in the same order, with the answers you had already saved. The clock kept running while you were away.",
    },
  ],
};

const TEACHER: YiqAudienceGuide = {
  audience: "teacher",
  label: "Teacher",
  title: "Entering your school",
  tagline: "One form, one team at a time, and codes you must save.",
  whoFor:
    "You are registering students from your school. You do not need an account to do it.",
  journey: [
    "Check your chapter is open",
    "Fill one form",
    "Save the codes",
    "Hand them out",
    "Watch the result",
  ],
  sections: [
    {
      id: "before-you-start",
      title: "Before you fill the form",
      steps: [
        {
          action: "You do not need an account.",
          detail:
            "Registration is a public form. No sign-up, no password, no waiting for approval.",
          link: { label: "Open the registration form", href: "/yiq/register" },
        },
        {
          action: "Decide the category first.",
          detail:
            "Junior is Classes 9 and 10. Senior is Classes 11 and 12. Every member of one team must be in the same category — the form rejects a mixed team, because the two are separate championships.",
          tip: "A Class 10 and a Class 11 student cannot be on the same team. Register two teams instead.",
        },
        {
          action: "A team is two or three students.",
          detail:
            "Not one, not four. The first student you list is the captain.",
        },
        {
          action: "You may enter up to three teams per category from one school.",
          detail:
            "That is up to three Junior teams and up to three Senior teams. Each one is a separate trip through the form.",
        },
        {
          action: "Your chapter has to have registration open.",
          detail:
            "The chapter list on the form only shows chapters that are open right now. If your city is missing, it has not opened yet or it has already closed.",
        },
      ],
    },
    {
      id: "the-form",
      title: "Filling the form",
      steps: [
        {
          action: "Pick your Yi chapter.",
          detail: "The chapter running YIQ for your city.",
          link: { label: "Register a team", href: "/yiq/register" },
        },
        {
          action: "Enter the school.",
          detail:
            "Name and school type are required. Board, city, state and the principal's name are optional — fill what you know.",
        },
        {
          action: "Enter yourself as the contact.",
          detail:
            "Your name, a working email and a ten-digit Indian mobile number. This is who the chapter contacts about your team.",
        },
        {
          action: "Name the team and add the students.",
          detail:
            "The team name is what appears on the scoreboard. For each student give their full name and class. Email and phone are optional.",
        },
        {
          action: "Submit.",
          detail:
            "If something is wrong the form says exactly what, in one line, and nothing is saved. Fix it and submit again.",
        },
      ],
    },
    {
      id: "the-codes",
      title: "The codes are shown once",
      steps: [
        {
          action: "Screenshot the confirmation screen before you leave it.",
          detail:
            "It lists one six-character code per student, plus the team code. The app never shows a student's code again — there is no screen anywhere that looks it up.",
          tip: "Do this first, before you close the tab or hand the phone to anyone. Recovering a lost code means going back to your chapter organiser.",
        },
        {
          action: "Give each student their own code, privately.",
          detail:
            "A code is that student's sign-in. A student who uses a teammate's code sits the paper as the teammate and burns the teammate's single attempt.",
        },
        {
          action: "Keep the team code with your records.",
          detail:
            "It identifies the team. Students can also see it on their own page after they sign in.",
        },
      ],
    },
    {
      id: "getting-them-ready",
      title: "Getting your students ready",
      steps: [
        {
          action: "Have them sign in and practise.",
          detail:
            "Practice is unlimited, shows the correct answers immediately, and never counts towards the team.",
          link: { label: "Student sign-in", href: "/yiq/login" },
        },
        {
          action: "Tell them the round that counts is one attempt only.",
          detail:
            "And that the clock runs on the server: reloading, closing the app or losing signal does not pause it.",
        },
        {
          action: "Make sure every member sits the paper.",
          detail:
            "The team score is the average of the members who sat, so an absent student no longer drags the team down. But fewer than two sitting and the team is out, whatever the remaining score.",
        },
        {
          action: "Check devices and signal the day before.",
          detail:
            "Each student needs their own phone or laptop, charged, on a connection that will hold for the length of the paper.",
        },
      ],
    },
    {
      id: "after-the-round",
      title: "After the round",
      steps: [
        {
          action: "Standings appear once your chapter publishes them.",
          detail:
            "Nothing is visible before that — not to you, not to the students.",
          link: { label: "Chapter results", href: "/yiq/results" },
        },
        {
          action: "The top teams are invited to the Chapter Finals.",
          detail:
            "Ten per category unless your chapter set another number. Your chapter contacts you about the date and venue.",
        },
        {
          action: "One champion team per category goes to the National Grand Finale.",
          detail:
            "Junior and Senior crown separate champions, and each goes straight to the national stage.",
        },
      ],
    },
  ],
  answers: [
    {
      q: "My chapter is not in the list.",
      a: "The list only holds chapters whose registration is open right now. Yours has not opened, or it has closed. Ask your Yi chapter — nothing on this side can add it.",
    },
    {
      q: "I mistyped a student's name or class.",
      a: "There is no self-service edit yet. Contact your chapter organiser with the team code and the correction.",
    },
    {
      q: "A student lost their code.",
      a: "Use your saved copy of the confirmation screen. If that is gone, your chapter organiser has to help — the app will not show the code a second time.",
    },
    {
      q: "Can I register more teams later?",
      a: "Yes, while registration is still open, up to three teams per category from your school. Each submission registers one team.",
    },
    {
      q: '"Too many registrations from this device."',
      a: "Ten team registrations an hour are allowed from one internet connection, which a whole school registering at once can hit. Wait an hour, or ask your chapter organiser to add the rest.",
    },
    {
      q: "Can I sit the paper myself to see it?",
      a: "No. Sign-in is by student access code only, and every code belongs to a registered student whose single attempt it would use.",
    },
  ],
};

const ORGANISER: YiqAudienceGuide = {
  audience: "organiser",
  label: "Organiser",
  title: "Running your chapter",
  tagline: "Open registration, run the round, publish, then run the finals.",
  whoFor:
    "You are a Yi chapter chair or a chapter organiser with YIQ access for your chapter.",
  journey: [
    "Open registration",
    "Close registration",
    "Open the online round",
    "Close it",
    "Publish standings",
    "Run the finals",
    "Crown a champion",
  ],
  sections: [
    {
      id: "where-you-work",
      title: "Where you work",
      steps: [
        {
          action: "Open the chapter dashboard.",
          detail:
            "It lists every chapter you are allowed to manage. Open one to get its event page.",
          link: { label: "Chapter dashboard", href: "/yiq/dashboard" },
        },
        {
          action: "If you get a 403, your access has not been granted yet.",
          detail:
            "YIQ access is per chapter. Ask your Yi chapter chair or a YIQ national admin to add you as an organiser for that chapter.",
          tip: "A Yi chapter chair already has chair-level YIQ access automatically, read straight from the Yi directory. Nobody needs to grant it separately.",
        },
        {
          action: "Read the four counts at the top of your event page.",
          detail:
            "Schools, Teams, Papers started and Papers submitted. During the round, Papers submitted against Teams is how you tell who still has to sit.",
        },
      ],
    },
    {
      id: "lifecycle",
      title: "Moving the event forward",
      steps: [
        {
          action: "The event walks through eight stages, one step at a time.",
          detail:
            "Draft, Registration open, Registration closed, Online round live, Online round closed, Finals scheduled, Finals live, Finals complete.",
          tip: "The console deliberately offers only the next step and the previous one. There is no dropdown to jump ahead, so nobody can skip the round under pressure on event day.",
        },
        {
          action: "Move to Registration open when schools may enter.",
          detail:
            "Your chapter only appears on the public registration form while it is at this stage.",
        },
        {
          action: "Move to Online round live when the paper should open.",
          detail:
            "Students see the round as open from this moment. Their own page changes to a Start button.",
          tip: "This is refused unless a YIQ national admin has published an online-round paper for BOTH Junior and Senior. The error names which one is missing — send that message to a national admin.",
        },
        {
          action: "Close the online round when the window ends.",
          detail:
            "Closing the round is also what opens each student's per-question answers to them. Until you close it, they see only that their paper is recorded.",
        },
        {
          action: "Going back a step does not ask you to confirm.",
          detail:
            'The forward button opens a confirmation. The "Back to …" button applies immediately.',
          tip: "Moving back from Online round closed to Online round live re-opens the paper for anyone who has not sat it. Only do it deliberately.",
        },
      ],
    },
    {
      id: "standings",
      title: "Standings and results",
      steps: [
        {
          action: 'Press "Compute and publish standings".',
          detail:
            "The button appears once the event is at Online round closed, Finals scheduled or Finals complete.",
        },
        {
          action: "Know what that one press does.",
          detail:
            "It sums each member's score into their team's total, ranks teams inside each category, marks the top teams as qualified and the rest eliminated, records the Best Individual Quizzer for each category, and stamps the results as published.",
        },
        {
          action: "Expect more qualifying teams than the number, sometimes.",
          detail:
            "A team level with the last qualifier on both score and total time is carried through rather than dropped to hit a round number. That is intended.",
        },
        {
          action: "You cannot see scores before you publish them.",
          detail:
            "Live standings before publication are visible to YIQ national admins only, by design. Your page says so where the table would be.",
        },
        {
          action: "It is safe to re-run.",
          detail:
            "The computation reads the attempts fresh every time and rewrites the rollup, so a late-landing paper is picked up by pressing it again.",
          tip: "Re-running restamps the published time and can change who qualified. Tell anyone you have already told the result.",
        },
        {
          action: "The qualifying count is ten unless your event says otherwise.",
          detail:
            "It is stored on the event and there is no screen for changing it yet. If your chapter needs a different number, ask a YIQ national admin before the round closes.",
        },
      ],
    },
    {
      id: "finals",
      title: "Running the Chapter Finals",
      steps: [
        {
          action: "Open the finals console for one category.",
          detail:
            "Open your chapter's event page, then add /finals to the address. Add ?category=senior for Senior; Junior is what you get by default.",
          tip: "Nothing on the event page links to the finals console yet, so the address bar is the only way in. Bookmark it before event day.",
        },
        {
          action: 'Press "Create the six rounds" once per category.',
          detail:
            "It creates Direct Questions, Pass-On, Visual, Audio, Rapid Fire and the India Challenge with their standard points.",
        },
        {
          action: "Only teams that qualified appear on the console.",
          detail:
            "So publish the standings before the finals — an unpublished round leaves the stage list empty.",
        },
        {
          action: 'Put one round live with "Go live", then score it.',
          detail:
            "Tap the team, then the outcome: Correct, Bonus, Passed or Wrong. The running total updates on each tap.",
        },
        {
          action: 'Fix a mis-tap with "Undo last".',
          detail:
            "Every tap is a new row and undo removes the most recent one. Nothing rewrites history, so the score trail survives a dispute.",
        },
        {
          action: 'Close the round with "Close round", then take the next one live.',
          detail: "A closed round stops accepting scores.",
        },
        {
          action: "Put the public scoreboard on the projector.",
          detail:
            "The finals console has a link to it. That page needs no login and no chrome — it is built for the LED wall behind the stage.",
        },
        {
          action: 'Crown the winner with "Crown".',
          detail:
            "It marks the team champion and enters it into the National Grand Finale automatically. One chapter, one champion per category.",
          tip: "Once a champion is set, the Crown buttons disappear from that category. Be sure before you press it.",
        },
      ],
    },
    {
      id: "who-can-do-what",
      title: "Who can do what",
      steps: [
        {
          action: "Chapter chair — everything for their own chapter, including deleting.",
          detail:
            "Granted by the Yi directory chair record, a YIQ chapter-admin role, or the chair email on the chapter.",
        },
        {
          action: "Chapter organiser — everything except deleting.",
          detail:
            "Runs the round and the finals, publishes the chapter's result. Cannot delete a team, a school or the event.",
        },
        {
          action: "Regional admin — every chapter event inside one Yi zone.",
          detail: "Full control within the zone, nothing outside it.",
        },
        {
          action: "National admin — every chapter, plus the question bank and papers.",
          detail:
            "The only tier that can see scores before they are published.",
        },
        {
          action: "A role with no scope grants nothing.",
          detail:
            "Every role has to name its chapter or its zone. A blank scope is rejected rather than read as 'all', so it can never quietly widen someone's access.",
        },
      ],
    },
  ],
  answers: [
    {
      q: "A school says my chapter is not on the registration form.",
      a: "The form lists only chapters at Registration open. Move your event to that stage and it appears.",
    },
    {
      q: "I cannot open the online round.",
      a: "A published online-round paper is missing for Junior, Senior or both. The error names which. Only a YIQ national admin can publish one.",
    },
    {
      q: "A student says their code does not work.",
      a: "Check the team is not withdrawn or disqualified — those are refused at sign-in with a different message. Otherwise it is a typo or a code that was never handed over.",
    },
    {
      q: "The standings look wrong.",
      a: "Check Papers submitted against Teams first. A team with members who never sat the paper scores the sum of the ones who did, so it ranks low on purpose. Re-run the computation if papers landed after you last published.",
    },
    {
      q: "Can I change how many teams qualify?",
      a: "Not from any screen today. It is stored on the event with a default of ten. Ask a YIQ national admin.",
    },
    {
      q: "I crowned the wrong team.",
      a: "The console will not let you crown a second team in that category. Contact a YIQ national admin — it also wrote a national entry that needs correcting.",
    },
  ],
};

const NATIONAL: YiqAudienceGuide = {
  audience: "national",
  label: "National",
  title: "The bank, the papers and the ladder",
  tagline:
    "National master data reaches every chapter. Change it deliberately.",
  whoFor: "You are a YIQ national admin.",
  journey: [
    "Build the bank",
    "Build papers",
    "Publish them",
    "Watch the chapters",
    "Run the ladder",
    "Crown a national champion",
  ],
  sections: [
    {
      id: "console",
      title: "Your console",
      steps: [
        {
          action: "Open the national admin page.",
          detail:
            "Four counts across the top — Questions, Topics, Papers, Teams registered — then three consoles: Question bank, YIQ team, National round.",
          link: { label: "National admin", href: "/yiq/admin" },
        },
        {
          action: "Read bank depth by topic before you build anything.",
          detail:
            "A topic under 20 questions is flagged. That is a floor, not a target — a live round needs far more, and the practice pool must not overlap the round pool.",
        },
        {
          action: "Remember the blast radius.",
          detail:
            "Questions, topics and papers are shared national master data. One edit here reaches every chapter in the edition.",
        },
      ],
    },
    {
      id: "bank",
      title: "The question bank",
      steps: [
        {
          action: "Add questions one at a time, or import a CSV.",
          detail:
            "You can upload a file or paste the rows. The placeholder in the paste box is the exact header line the importer expects.",
          link: { label: "Question bank", href: "/yiq/admin/questions" },
        },
        {
          action: "Fill in topic, category, kind, difficulty and the answer.",
          detail:
            "Category is Junior, Senior or Both. Explanation and source are optional but worth writing — the review screen shows the explanation to students.",
        },
        {
          action: "Retire a question instead of deleting it.",
          detail:
            'The "In circulation" switch takes it out of future papers without breaking the papers it is already on.',
        },
        {
          action: "Know the pool rule, because it is the integrity of the competition.",
          detail:
            "Every question is practice, competition or either. A practice paper draws from practice and either. A scored paper draws from competition and either, and never from practice.",
          tip: "Before this rule existed, the practice paper and the real paper were built from the same 33 questions — anyone who practised had already sat the paper. Do not put a competition question into the practice pool to bulk it out.",
        },
        {
          action: "A paper that cannot be built fails loudly.",
          detail:
            "An unknown paper kind or a missing pool value yields no eligible questions at all, rather than quietly falling back to whatever is available.",
        },
      ],
    },
    {
      id: "papers",
      title: "Papers",
      steps: [
        {
          action: "Build a paper from the tools at the bottom of the national admin page.",
          detail:
            "Name, category, kind — Practice or Final online round — number of questions (up to 200, 25 by default), minutes (up to 240, 30 by default), and negative marks per wrong answer (0 by default, in steps of 0.25).",
          link: { label: "National admin", href: "/yiq/admin" },
        },
        {
          action: "Expect a refusal if the bank is too thin.",
          detail:
            "The builder says how many usable questions it actually found for that category, so you know how many more to write.",
        },
        {
          action: "Publish an online-round paper for Junior AND Senior.",
          detail:
            "A chapter is blocked from opening its online round until both exist. That block is the single most common reason an organiser cannot start on the day.",
        },
        {
          action: "Negative marking never puts a student in debt.",
          detail:
            "Marks come off a wrong answer only. An unanswered question scores zero, and a paper total is floored at zero.",
        },
      ],
    },
    {
      id: "team",
      title: "Who can run YIQ",
      steps: [
        {
          action: "Grant and revoke roles from the YIQ team console.",
          detail:
            "Four roles: national admin, regional admin (one zone), chapter chair and chapter organiser (one chapter each).",
          link: { label: "YIQ team", href: "/yiq/admin/team" },
        },
        {
          action: "Every role has to name its scope.",
          detail:
            "A chapter role needs a chapter, a zone role needs a zone. A grant with a blank scope is rejected — it would read to a human as access while granting nothing.",
        },
        {
          action: "Do not grant chapter chair to the actual chair.",
          detail:
            "A Yi chapter chair already holds chair-level YIQ access through the directory. Grant that role only to someone who is not the chair but needs the same power.",
        },
        {
          action: "You cannot create another national admin.",
          detail: "Only a platform super-admin can do that.",
        },
        {
          action: "Roles live in the Yi directory, not in a YIQ table.",
          detail:
            "A YIQ role is a row in the directory's role assignments with the app set to yiq. There is no separate YIQ organisers table and there must never be one.",
        },
      ],
    },
    {
      id: "ladder",
      title: "The national ladder",
      steps: [
        {
          action: "Open the national console.",
          detail: "One board per category, off the active edition.",
          link: { label: "National ladder", href: "/yiq/national" },
        },
        {
          action: "The ladder depth is derived, never fixed.",
          detail:
            "How many stages run comes from how many chapter champions actually entered. A large field runs Quarter-Final, Semi-Final and Final; a small one goes straight to the Final.",
        },
        {
          action: "Junior and Senior are separate all the way up.",
          detail:
            "Every function filters to one category internally, so a Junior team can never appear in a Senior ranking.",
        },
        {
          action: "Type in each team's total for the Quarter-Final and Semi-Final.",
          detail:
            "Those two stages are written papers. The typed total is stored on its own and never overwrites live on-stage taps.",
        },
        {
          action: "Publishing a stage is refused while any team in the field is unscored.",
          detail:
            "Ranking a half-scored field would eliminate teams for unfinished data entry rather than for their answers.",
        },
        {
          action: "A team with no score is not a team on zero.",
          detail:
            "An unscored team sorts below every scored team and never ties its way through a cut. A real total of zero is a different thing.",
        },
        {
          action: "Teams tied with the last qualifier are carried through.",
          detail:
            "So a stage's qualifying set may legitimately be larger than the ladder asked for. The console tells you when that has happened.",
        },
        {
          action: "Crown the national champion at the end.",
          detail:
            "The Final field's totals freeze first. The crowned team becomes national champion, the best remaining team — and anyone level with it — runner-up, and everyone else who stood on stage a finalist.",
        },
      ],
    },
  ],
  answers: [
    {
      q: "An organiser says they cannot open their online round.",
      a: "A published online-round paper is missing for Junior, Senior or both in the active edition. Build and publish it; their button then works with no further change on their side.",
    },
    {
      q: "Can I reuse last edition's questions?",
      a: "Yes, the bank is not per-edition. Watch the pool value: anything already public belongs in practice, and a practice question can never reach a scored paper.",
    },
    {
      q: "How many stages will the national ladder run?",
      a: "Whatever the entrant count implies. It is computed from the live number of chapter champions who entered, not configured, so it changes as chapters crown their champions.",
    },
    {
      q: "A stage will not publish.",
      a: "At least one team in that stage's field has no score row. Enter the missing totals — the refusal is protecting teams from being eliminated by a gap in data entry.",
    },
    {
      q: "Why can a chapter organiser not see their own live scores?",
      a: "Deliberate. Pre-publication standings are national-tier only, so a chapter cannot act on a partial picture while its own students are still sitting the paper.",
    },
  ],
};

export const YIQ_GUIDE: YiqGuideBook = {
  student: STUDENT,
  teacher: TEACHER,
  organiser: ORGANISER,
  national: NATIONAL,
};
