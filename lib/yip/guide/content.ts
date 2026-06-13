/**
 * In-app adaptive guide — authored content for all four YIP personas.
 *
 * Adapted from docs/yip-guides/*.md (chapter-agnostic source). Rewritten at a
 * 12th-grade reading level for a phone drawer. Event-scoped organiser links use
 * the literal `:eventId` token (resolved at render time); student /me, jury, and
 * volunteer links read the session and never need a token.
 *
 * Plain data module — NO "use server". Safe to import from client + server.
 */

import type { GuideBook, PersonaGuide } from "@/lib/yip/guide/types";

const organiser: PersonaGuide = {
  persona: "organiser",
  title: "Organiser Guide",
  tagline:
    "You run the live floor — setup, elections, chat, jury and results — for your chapter's 2-day parliament.",
  pdfPath: "/yip/guides/organiser.pdf",
  sections: [
    {
      id: "what-youre-running",
      title: "What you're running",
      summary:
        "YIP is a **2-day mock parliament** for school students (Classes 9–12). Your students play Speaker, Prime Minister, Ministers and MPs and debate real topics while a jury scores them out of **/100**. On Day 2 the scores become a leaderboard and awards.",
      tips: [
        "Your job: finish the setup checklist, run the floor from the **Control** tab, run the elections, watch the chat, keep the jury scoring, and publish results.",
        "Every event-specific detail — dates, party count, jury, contacts — is on your printed **cover sheet**. Nothing is pre-done for your event.",
      ],
    },
    {
      id: "logging-in",
      title: "Logging in",
      summary:
        "Sign in with your chapter's organiser email and password (or **Continue with Google**). You land on **My Events** — tap your event's card to go inside.",
      steps: [
        "Go to **/yip/login**.",
        "Type your **Email** and **Password**, then tap **Sign in**.",
        "On **My Events**, tap your event's card.",
      ],
      tips: [
        "Don't see your event? Hard refresh (Ctrl/Cmd + Shift + R) and sign in again. **Never create a duplicate event** — call the tech-on-call instead.",
        "Every organiser account can do everything here, and is also a **chat moderator**.",
      ],
      links: [{ label: "Open My Events", href: "/yip/dashboard" }],
    },
    {
      id: "setup-checklist",
      title: "Before the event: setup checklist",
      summary:
        "Work through these **in order** — each step depends on the one before. Finish all of them before your rehearsal.",
      steps: [
        "**Participants** — check every registered student is listed; each row shows their 6-character access code (this goes on their badge).",
        "**Allocation** — run it. It splits the house into Government and Opposition, fills the leadership (Speaker candidates, PM, Cabinet, Leader of Opposition) and gives everyone a constituency.",
        "**Parties** — tap **Form Parties** and choose your party count (2–8; handbook standard is 7–8). Allocation must be run first.",
        "**Topics** — pick the debate topics for your event.",
        "**Questions** — students submit Question Hour questions from their phones; you approve the ones you want live.",
        "**Volunteers** — add your YUVA volunteers and **set an access code for each** (no code = can't log in).",
        "**Jury** — add each juror by **email**; they sign in with email on the join page.",
        "**Chat** — tap **Create channels** (one per party, one per committee, plus read-only Announcements). Form parties first.",
      ],
      tips: [
        "Seeing **zero constituencies from your own state** is on purpose (the host state is excluded). Don't 'fix' it.",
        "Re-running Allocation or Form Parties reshuffles **everyone** — only do it for a deliberate full redo.",
      ],
      links: [
        { label: "Open Participants", href: "/yip/dashboard/events/:eventId/participants" },
        { label: "Open Allocation", href: "/yip/dashboard/events/:eventId/allocation" },
        { label: "Open Parties", href: "/yip/dashboard/events/:eventId/parties" },
        { label: "Open Topics", href: "/yip/dashboard/events/:eventId/topics" },
        { label: "Open Questions", href: "/yip/dashboard/events/:eventId/questions" },
        { label: "Open Volunteers", href: "/yip/dashboard/events/:eventId/volunteers" },
        { label: "Open Jury", href: "/yip/dashboard/events/:eventId/jury" },
        { label: "Open Chat", href: "/yip/dashboard/events/:eventId/chat" },
      ],
    },
    {
      id: "rehearsal",
      title: "Run a rehearsal first",
      summary:
        "About a week before Day 1, do a full dry-run with a few organisers, volunteers, a juror and some test students. It catches the surprises while there's still time to fix them.",
      steps: [
        "Log in on every organiser account your chapter uses.",
        "Open **Control**, start a timer, fire a sub-phase preset.",
        "Run one practice party-leader election end to end (Hold → Open → vote on a phone → Close → Reveal).",
        "Have a volunteer log in and confirm their **Vote Kiosk** wakes when the vote opens.",
        "Have a juror sign in and submit one practice score.",
        "Open the **projector view** on the real hall projector.",
        "Send a chat message, **report** it from a student phone, and clear it from the **Reported** queue.",
      ],
      links: [{ label: "Open Control", href: "/yip/dashboard/events/:eventId/control" }],
    },
    {
      id: "running-day-1",
      title: "Running Day 1",
      summary:
        "The **Control** tab is your cockpit. Tap **Start Day 1**, then drive the agenda with **Next** (advance everyone) and **Skip** (jump an item). Every student, jury and projector screen follows what you do.",
      steps: [
        "Tap **Start Day 1** and confirm. The event goes live.",
        "Use the timer card (it auto-fills from each item's planned time) — usually just tap **Start**.",
        "Run the **Speaker Election** when that item is current; winner becomes Speaker, next two become Deputy Speakers.",
        "Run the **party-leader elections**, one party at a time, during the formation items.",
        "Reach the first scored session (Matters of Urgent Public Importance) — confirm the jury are scoring.",
        "After the last item, tap **End Day 1**.",
      ],
      tips: [
        "If the agenda sidebar is empty when you first open Control, call the tech-on-call **before** event morning, not on the day.",
        "For fast sessions, one-tap **sub-phase preset** buttons appear under the timer (Question / Answer / Speech / Rebuttal etc.).",
      ],
      links: [{ label: "Open Control", href: "/yip/dashboard/events/:eventId/control" }],
    },
    {
      id: "running-day-2",
      title: "Running Day 2",
      summary:
        "Tap **Start Day 2** and run the same way. Day 2 adds Question Hour, Zero Hour, the central debate and the bill votes — then you compute and publish results.",
      steps: [
        "**Question Hour** — the console shows each question, who asked it, and the ministry to answer. Tap **Mark Answered** when done; the queue is the questions you approved earlier.",
        "**Zero Hour** — students raise urgent matters via **Raise a Motion** on their phones; review them in the **Motions** tab and call students to speak.",
        "**Bill Presentation & Voting** — each committee presents; the house votes Aye/No; the reveal shows BILL PASSED or BILL REJECTED.",
        "Lock scores and compute results (see Results & Awards), then show the awards on the projector.",
        "After the National Anthem, tap **Complete Event**.",
      ],
      links: [
        { label: "Open Control", href: "/yip/dashboard/events/:eventId/control" },
        { label: "Open Motions", href: "/yip/dashboard/events/:eventId/motions" },
        { label: "Open Bills", href: "/yip/dashboard/events/:eventId/bills" },
      ],
    },
    {
      id: "elections-and-voting",
      title: "Elections & voting",
      summary:
        "All voting runs from the **Digital Voting** card on the Control Panel. The moment you open a vote, an orange **VOTE NOW** card appears on every eligible student's phone.",
      steps: [
        "**Speaker election** — Open → students vote (you see a live tally they can't) → **Close Voting** → **Reveal Results**.",
        "**Party-leader elections** — tap **Hold Election** per party, pick 3–5 nominees, **Open** → only that party votes → Close → Reveal.",
        "**Bill votes** — **Open Bill Vote**; students choose Aye / Nay / Abstain; Close → Reveal shows the result.",
        "**Tie?** A banner offers **Open 60-second runoff** — only tied candidates, and everyone votes again.",
      ],
      tips: [
        "**Known quirk — read twice:** after Open / Close / Reveal the panel sometimes doesn't update on its own. **Refresh the page** — the action already happened. **Do not click the button twice.**",
        "Students without phones: use the **roll-call list** to record their spoken vote, or let a YUVA volunteer's **Vote Kiosk** capture it. A wrong entry can be fixed with **Correct Vote** (a reason is required and logged).",
      ],
      links: [{ label: "Open Control", href: "/yip/dashboard/events/:eventId/control" }],
    },
    {
      id: "chat-moderation",
      title: "Chat moderation",
      summary:
        "The **Chat** tab is your moderation console. Every organiser is a moderator — agree who watches it during sessions.",
      steps: [
        "**Channels** — read any channel (one per party, one per committee, plus Announcements). **Delete** a message or **Freeze** a channel to stop posting; unfreeze when done.",
        "**Reported** — every message a student reports lands here. Delete it and/or mute the sender.",
        "**Direct messages** — oversight of student-to-YUVA mentor DMs. There are **no student-to-student DMs**.",
        "**Muted students** — see who's muted and unmute them.",
        "Use the **Announcements** composer for schedule changes and 'results in 10 minutes' calls (students can read it, not post).",
      ],
      tips: [
        "Brief students on Day 1: be respectful, organisers see everything, and the report button is there for a reason.",
      ],
      links: [{ label: "Open Chat", href: "/yip/dashboard/events/:eventId/chat" }],
    },
    {
      id: "jury-and-scoring",
      title: "Jury & scoring oversight",
      summary:
        "Jurors score on **their own phones** with email sign-in — never your login. The **Scoring** tab shows you live progress so you can chase anyone who's behind.",
      steps: [
        "Glance at the **Scoring** tab after each scored session — it shows how many scores are in, per session.",
        "Chase jurors who are behind **before** the next session starts.",
        "If the hall Wi-Fi drops, jurors keep scoring; their phones sync automatically when it's back — don't panic over a 'syncing' badge.",
        "When all scoring is done, turn **Scores locked** ON in Control (this blocks all jury submissions). Unlock if a juror still needs to finish.",
      ],
      tips: [
        "Each student is scored out of **/100**: six juror components total 90, plus an automatic position bonus (max 10) the system adds for leadership roles. Jurors never add the bonus.",
        "Jurors can only score the **current** session and the **immediately-previous** one — so they can finish a sheet after you advance, but not go further back.",
      ],
      links: [
        { label: "Open Scoring", href: "/yip/dashboard/events/:eventId/scoring" },
        { label: "Open Control", href: "/yip/dashboard/events/:eventId/control" },
      ],
    },
    {
      id: "results-and-awards",
      title: "Results, awards & certificates",
      summary:
        "Late on Day 2, after the last scored session: lock scores, compute the results, check them with a human eye, then publish so students and jury can see them.",
      steps: [
        "Confirm the **Scoring** tab shows all expected scores, then turn **Scores locked** ON in Control.",
        "Open **Results** and tap **Compute Results**.",
        "**Sanity-check before publishing** — the leaderboard (/100) and the award winners. Ties are handled (co-winners are shown).",
        "Tap **Publish** (you can unpublish to correct something, then publish again).",
        "Use the **Certificates** tab to generate participation and award certificates.",
        "Show the leaderboard on the big screen via **Open Projector View** for the ceremony.",
      ],
      links: [
        { label: "Open Results", href: "/yip/dashboard/events/:eventId/results" },
        { label: "Open Certificates", href: "/yip/dashboard/events/:eventId/certificates" },
      ],
    },
    {
      id: "troubleshooting",
      title: "Troubleshooting & who to contact",
      summary:
        "Golden rule: **refresh first, fully-close-and-reopen second, call the tech-on-call** if it's still blocking the event. The tech-on-call and event admin are on your cover sheet.",
      tips: [
        "**Open/Close/Reveal did nothing?** The known quirk — refresh; the action already went through. Don't click again.",
        "**A device looks stale?** Refresh; if the student installed the app, have them fully close and reopen it.",
        "**Can't log in with a code?** Re-check the 6 characters (`0` vs `O`, `1` vs `I`). Volunteers with an empty code field can't log in — set one.",
        "**VOTE NOW didn't appear?** Confirm the vote is open in Control; have the student reopen the app, or capture the vote via roll-call / kiosk.",
        "**Jury scores not coming in?** Check **Scores locked** isn't ON, and the juror used the email you registered. Offline scores sync later.",
        "**Locked out / forgot password?** Passwords can't be looked up — ask the tech-on-call to reset.",
      ],
    },
  ],
};

const student: PersonaGuide = {
  persona: "student",
  title: "Student Guide",
  tagline:
    "You're a Member of Parliament for two days — debate, ask questions, draft a bill and vote, all from your phone.",
  pdfPath: "/yip/guides/student.pdf",
  sections: [
    {
      id: "join-with-your-code",
      title: "Join with your code",
      summary:
        "Bring your phone, **fully charged**, both days. Everything — voting, questions, chat — happens on it. No email or password needed.",
      steps: [
        "Go to **/yip/join**.",
        "Type the **6-character access code printed on your badge** into the **Your Access Code** box.",
        "Tap **Enter Parliament**.",
      ],
      tips: [
        "Lost your badge? The registration desk has your code.",
        "If asked, tap **Install Yi Connect** so it opens like a real app.",
        "No phone? No problem — a YUVA volunteer or organiser will record your vote for you.",
      ],
      links: [{ label: "Go to Join", href: "/yip/join" }],
    },
    {
      id: "your-dashboard",
      title: "Your dashboard",
      summary:
        "Your home screen shows your role, party, school and constituency, plus a **Live Now** card that tells you what the house is doing right now — it updates by itself.",
      tips: [
        "**Live Now** shows the current agenda item and the countdown timer.",
        "**Your party roster** lists your party members; **Your YUVA & Yi Contact** shows who's there to help you.",
      ],
      links: [
        { label: "Open My Dashboard", href: "/yip/me" },
        { label: "Open My Journey", href: "/yip/me/journey" },
      ],
    },
    {
      id: "ask-a-question",
      title: "Ask a Question (Question Hour)",
      summary:
        "Submit your Question Hour questions before the event. Organisers approve them; if yours is approved, you may be called to ask it live.",
      steps: [
        "Open **Questions** and tap **Submit**.",
        "Write your question (at least **20 characters**) and pick the **ministry** it's for.",
        "Submit up to **3 questions** — don't wait for the deadline; submissions close before the event.",
      ],
      links: [{ label: "Open Questions", href: "/yip/me/questions" }],
    },
    {
      id: "debate-and-motions",
      title: "Debate & raising a motion",
      summary:
        "During **Zero Hour** you can raise an urgent public matter for the house. Submit it before the deadline shown, and you may be called to speak.",
      steps: [
        "Open **Raise a Motion** from your dashboard.",
        "Write your urgent matter and submit it **before the deadline**.",
      ],
      links: [{ label: "Open Motions", href: "/yip/me/motion" }],
    },
    {
      id: "draft-your-bill",
      title: "Draft your committee bill",
      summary:
        "If you're on a bill committee, you draft and submit your committee's bill from your phone. Later, the whole house votes on it.",
      steps: [
        "Open **Bill Drafting** (committee members only).",
        "Write and submit your committee's bill with your team.",
      ],
      links: [{ label: "Open Bill", href: "/yip/me/bill" }],
    },
    {
      id: "voting",
      title: "Voting on the floor",
      summary:
        "An orange **VOTE NOW** card appears the moment a vote opens — Speaker election, your party-leader election, or a bill vote. Tap it, pick your choice, done.",
      steps: [
        "When **VOTE NOW** appears, tap it.",
        "Pick your choice — you'll see **'Your vote has been recorded.'**",
        "Vote **once** — that's your ballot.",
      ],
      tips: [
        "No phone, or it's not working? A YUVA volunteer captures your vote — you still pick your own choice.",
      ],
      links: [{ label: "Open Vote", href: "/yip/me/vote" }],
    },
    {
      id: "chat-rules",
      title: "Chat rules",
      summary:
        "You have a **party** channel and a **committee** channel, plus a read-only **Announcements** channel (read it — schedule changes land there).",
      tips: [
        "Need help privately? Use **Message a YUVA mentor**. There are **no student-to-student DMs**.",
        "**Be respectful** — organisers see every message. See something off? Use the **report** button; don't reply to it.",
        "Misuse gets your messages deleted and you muted.",
      ],
      links: [{ label: "Open Chat", href: "/yip/me/chat" }],
    },
    {
      id: "certificate-and-help",
      title: "Your certificate & getting help",
      summary:
        "After results are published you can see how you did, and a participation (or award) certificate is generated for you. Share your feedback to tell us how the event went.",
      tips: [
        "If something looks stuck, fully **close and reopen** the app — don't just refresh. Still stuck? Show a YUVA volunteer or organiser.",
      ],
      links: [
        { label: "Open My Journey", href: "/yip/me/journey" },
        { label: "Share Feedback", href: "/yip/me/feedback" },
      ],
    },
  ],
};

const volunteer: PersonaGuide = {
  persona: "volunteer",
  title: "YUVA Volunteer Guide",
  tagline:
    "Your phone is a roving voting booth — when a vote opens, students without phones vote through you.",
  pdfPath: "/yip/guides/volunteer.pdf",
  sections: [
    {
      id: "what-a-yuva-does",
      title: "What a YUVA does",
      summary:
        "You're the floor team. Your main job is the **Vote Kiosk** — capturing votes from students who don't have a phone — plus helping students log in and find their way.",
    },
    {
      id: "log-in",
      title: "Log in with your code",
      summary:
        "You have your **own 6-character access code** from the organisers — it is **not** a student code. After you log in, your screen becomes a **Vote Kiosk**.",
      steps: [
        "Go to **/yip/join**.",
        "Type your code into the **Your Access Code** box and tap **Enter Parliament**.",
        "Your screen shows **Vote Kiosk** with **'Waiting for the organizer to open a vote…'** — that's correct. Keep it open.",
      ],
      links: [{ label: "Go to Join", href: "/yip/join" }],
    },
    {
      id: "run-the-kiosk",
      title: "Run a voting kiosk",
      summary:
        "When the organisers open a vote, your screen **wakes up by itself** — no refresh needed. Then capture each student's vote, one at a time.",
      steps: [
        "**Find the student** — search the list by serial number or name and tap them.",
        "**Hand them the phone** (or hold it where they can see) — they pick their own choice.",
        "Tap **Confirm**. The screen returns to the list for the next student.",
      ],
      tips: [
        "When voting closes, your screen goes back to 'Waiting…' — leave it open for the next vote.",
        "If a student already voted on their own phone, the list tells you — they can't vote twice.",
      ],
      links: [{ label: "Open Kiosk", href: "/yip/volunteer" }],
    },
    {
      id: "etiquette",
      title: "Rules of the booth",
      summary:
        "The ballot is secret and the student decides. Keep it clean and fair.",
      tips: [
        "One student at a time. **The student picks — never pick for them.**",
        "Don't announce or discuss anyone's choice.",
        "Made a mistake? Tell an organiser immediately — they can correct a vote (with a logged reason). Don't try to fix it yourself.",
      ],
    },
    {
      id: "helping-students",
      title: "Helping students & messages",
      summary:
        "Between votes you help students log in, point them to the **Live Now** card when they ask 'what's happening', and walk lost students to the help desk. Students can also message you privately.",
      tips: [
        "Login typos are usually `0` vs `O` and `1` vs `I` — codes are on their badges.",
        "Students can message you via **'Message a YUVA mentor'**, but **you can't reply in the app**. Handle it in person or pass it to an organiser.",
        "Anything worrying in a message (bullying, a student in distress) → straight to an organiser.",
        "If your screen looks stuck, fully close and reopen the app, then log in again with your code.",
      ],
    },
  ],
};

const jury: PersonaGuide = {
  persona: "jury",
  title: "Jury Guide",
  tagline:
    "You watch and score each participant out of /100 on your own phone — the screen follows the house for you.",
  pdfPath: "/yip/guides/jury.pdf",
  sections: [
    {
      id: "sign-in",
      title: "Signing in with email",
      summary:
        "You score on **your own phone** — never an organiser's login. Sign in with the **email the organisers registered for you**.",
      steps: [
        "Go to **/yip/join**.",
        "Tap **'Jury member? Sign in with email'** and sign in with your registered email.",
        "You land on the scoring screen.",
      ],
      links: [{ label: "Go to Jury Sign-in", href: "/yip/jury/login" }],
    },
    {
      id: "the-rubric",
      title: "The /100 workbook rubric",
      summary:
        "You score **six components** on the official **Yi 2026 Evaluation Workbook**, each in its own session as the event reaches it. Together they total **90 from you**.",
      tips: [
        "**MUPI / Opening Speech (15)** — research, relevance to the Central Agenda, and delivery.",
        "**Question Hour (20)** — quality of the question asked, or of the minister's answer.",
        "**Zero Hour (15)** — how well they raise and argue an urgent matter.",
        "**Political Acumen (10)** — coalition building, strategy, negotiation, floor presence.",
        "**Committee (15)** — contribution in committee discussion and bill drafting.",
        "**Bill Presentation (15)** — how well they present and defend their committee's bill.",
        "The last **10 (Position Points)** is added **automatically by the system** for leadership roles — **never add it yourself**.",
      ],
      links: [{ label: "Open Scoring", href: "/yip/jury" }],
    },
    {
      id: "scoring-a-speaker",
      title: "Scoring a speaker",
      summary:
        "The screen **follows the house** — the session you're scoring is pre-set by the organiser and switches automatically when the house moves on. The current speaker appears on their own.",
      steps: [
        "Watch the current speaker — they appear on the screen automatically.",
        "Score them against the component for the current session.",
        "Need someone specific? Search by number, constituency, or name.",
      ],
      tips: [
        "You can **finish the previous session** after the house advances — but only that one, so don't fall more than a session behind.",
        "You can edit a score until the organisers lock scoring at the end.",
      ],
      links: [{ label: "Open Scoring", href: "/yip/jury" }],
    },
    {
      id: "offline-and-sync",
      title: "Offline scoring & sync",
      summary:
        "If the hall Wi-Fi drops, keep scoring exactly as normal. Your scores are saved on your phone and **sync automatically** when the connection returns.",
      tips: [
        "A small sync badge shows the status — ignore it and keep going.",
        "If something looks stuck, fully close and reopen the tab or app, then sign in again. Your submitted scores are safe.",
      ],
    },
    {
      id: "your-history",
      title: "Your scoring history",
      summary:
        "Your **History** screen lists the scores you've already submitted, so you can confirm you haven't missed anyone before the next session starts.",
      links: [{ label: "Open History", href: "/yip/jury/history" }],
    },
    {
      id: "fairness-rules",
      title: "Fairness rules",
      summary:
        "Your scores feed a shared leaderboard, so consistency and discretion matter.",
      tips: [
        "**Don't share scores aloud** — not with students, jurors, or anyone within earshot. Angle your screen away.",
        "Score **every** student you observe in a session — gaps hurt the leaderboard's fairness.",
        "Unsure about a rubric line? Quietly ask an organiser between sessions, not mid-speech.",
      ],
    },
  ],
};

export const GUIDES: GuideBook = {
  organiser,
  student,
  volunteer,
  jury,
};
