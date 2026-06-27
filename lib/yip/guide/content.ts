/**
 * In-app adaptive guide — authored content for all four YIP personas.
 *
 * Adapted from docs/yip-guides/*.md (chapter-agnostic source) and rewritten at
 * a 12th-grade reading level. One ACTION per step; every step that points at a
 * real page carries its own deep-link (`step.link`) so the guide doubles as a
 * launchpad. Event-scoped organiser links use the literal `:eventId` token
 * (resolved at render time); student / jury / volunteer links read the session
 * and never need a token.
 *
 * Operating decisions reflected here (locked 2026-06-13):
 *   - Scores, the leaderboard and Results are **super-admin only**. Organisers
 *     run the floor and lock scoring from Control, but they do NOT open the
 *     Scoring or Results dashboards or compute/publish results themselves.
 *   - A committee bill can be uploaded by **one** committee member — the first
 *     person to submit locks it for the whole committee.
 *
 * Plain data module — NO "use server". Safe to import from client + server.
 */

import type { GuideBook, PersonaGuide } from "@/lib/yip/guide/types";

const organiser: PersonaGuide = {
  persona: "organiser",
  title: "Organiser Guide",
  tagline:
    "You run the live floor — setup, elections, chat and jury — for your chapter's 2-day parliament.",
  pdfPath: "/yip/guides/organiser.pdf",
  journey: [
    "Sign in",
    "Finish setup",
    "Rehearse",
    "Run Day 1",
    "Run Day 2",
    "Wrap up",
  ],
  sections: [
    {
      id: "what-youre-running",
      title: "What you're running",
      steps: [
        {
          action: "Understand the event: a 2-day mock parliament for Classes 9–12.",
          detail:
            "Your students play Speaker, Prime Minister, Ministers and MPs and debate real topics while a jury scores them out of **/100**.",
        },
        {
          action: "Know your job: finish setup, run the floor, run elections, watch chat, keep the jury scoring.",
          detail:
            "You drive everything from the **Control** tab. Day 2 ends with awards and certificates.",
        },
        {
          action: "Keep your printed cover sheet next to you.",
          tip: "Every event-specific detail — dates, party count, jury, contacts — is on it. Nothing is pre-done for your event.",
        },
      ],
    },
    {
      id: "logging-in",
      title: "Logging in",
      steps: [
        {
          action: "Go to the sign-in page and enter your organiser email and password.",
          detail: "You can also tap **Continue with Google** with your chapter account.",
          link: { label: "Open My Events", href: "/yip/dashboard" },
        },
        {
          action: "On **My Events**, tap your event's card to go inside.",
          tip: "Don't see your event? Hard refresh (Ctrl/Cmd + Shift + R) and sign in again. **Never create a duplicate event** — call the tech-on-call instead.",
        },
        {
          action: "Remember every organiser account can do everything here.",
          detail: "You are also a **chat moderator** by default.",
        },
      ],
    },
    {
      id: "setup-checklist",
      title: "Before the event: setup checklist",
      steps: [
        {
          action: "Open **Participants** and check every registered student is listed.",
          detail: "Each row shows their 6-character access code — this goes on their badge.",
          link: { label: "Open Participants", href: "/yip/dashboard/events/:eventId/participants" },
        },
        {
          action: "Open **Allocation** and run it.",
          detail:
            "It splits the house into Government and Opposition, fills the leadership (Speaker candidates, PM, Cabinet, Leader of Opposition) and gives everyone a constituency.",
          tip: "Seeing **zero constituencies from your own state** is on purpose — the host state is excluded. Don't 'fix' it.",
          link: { label: "Open Allocation", href: "/yip/dashboard/events/:eventId/allocation" },
        },
        {
          action: "Open **Parties**, tap **Form Parties**, and choose your party count.",
          detail: "2–8 parties; the handbook standard is 7–8. Allocation must be run first.",
          tip: "Re-running Allocation or Form Parties reshuffles **everyone** — only do it for a deliberate full redo.",
          link: { label: "Open Parties", href: "/yip/dashboard/events/:eventId/parties" },
        },
        {
          action: "Open **Topics** and pick the debate topics for your event.",
          link: { label: "Open Topics", href: "/yip/dashboard/events/:eventId/topics" },
        },
        {
          action: "Open **Questions** and approve the Question Hour questions you want live.",
          detail: "Students submit these from their phones before the event.",
          link: { label: "Open Questions", href: "/yip/dashboard/events/:eventId/questions" },
        },
        {
          action: "Open **Volunteers**, add your YUVA volunteers, and set an access code for each.",
          tip: "No code = they can't log in. Set one for every volunteer.",
          link: { label: "Open Volunteers", href: "/yip/dashboard/events/:eventId/volunteers" },
        },
        {
          action: "Open **Jury** and add each juror by **email**.",
          detail: "Jurors sign in with that email on the join page — never your login.",
          link: { label: "Open Jury", href: "/yip/dashboard/events/:eventId/jury" },
        },
        {
          action: "Open **Chat** and tap **Create channels**.",
          detail: "One channel per party, one per committee, plus a read-only Announcements channel. Form parties first.",
          link: { label: "Open Chat", href: "/yip/dashboard/events/:eventId/chat" },
        },
      ],
    },
    {
      id: "rehearsal",
      title: "Run a rehearsal first",
      steps: [
        {
          action: "About a week before Day 1, do a full dry-run with a few helpers and test students.",
          detail: "It catches the surprises while there's still time to fix them.",
        },
        {
          action: "Log in on every organiser account, open **Control**, start a timer, and fire a sub-phase preset.",
          link: { label: "Open Control", href: "/yip/dashboard/events/:eventId/control" },
        },
        {
          action: "Run one practice party-leader election end to end.",
          detail: "Hold → Open → vote on a phone → Close → Reveal.",
        },
        {
          action: "Have a volunteer confirm their **Vote Kiosk** wakes when the vote opens, and a juror submit one practice score.",
        },
        {
          action: "Open the **projector view** on the real hall projector, then test a chat report end to end.",
          detail: "Send a message, report it from a student phone, and clear it from the Reported queue.",
        },
      ],
    },
    {
      id: "running-day-1",
      title: "Running Day 1",
      steps: [
        {
          action: "Open **Control** — this is your cockpit — and tap **Start Day 1**.",
          detail: "Every student, jury and projector screen follows what you do here.",
          link: { label: "Open Control", href: "/yip/dashboard/events/:eventId/control" },
        },
        {
          action: "Drive the agenda with **Next** (advance everyone) and **Skip** (jump an item).",
          tip: "If the agenda sidebar is empty when you first open Control, call the tech-on-call **before** event morning — not on the day.",
        },
        {
          action: "Use the timer card — it auto-fills from each item's planned time, so usually just tap **Start**.",
          tip: "For fast sessions, one-tap **sub-phase preset** buttons appear under the timer (Question / Answer / Speech / Rebuttal).",
        },
        {
          action: "Run the **Speaker Election** when that item is current.",
          detail: "The winner becomes Speaker; the next two become Deputy Speakers.",
        },
        {
          action: "Run the **party-leader elections**, one party at a time, during the formation items.",
        },
        {
          action: "Reach the first scored session (Matters of Urgent Public Importance) and confirm the jury are scoring, then tap **End Day 1** after the last item.",
        },
      ],
    },
    {
      id: "running-day-2",
      title: "Running Day 2",
      steps: [
        {
          action: "Tap **Start Day 2** in Control and run the same way.",
          detail: "Day 2 adds Question Hour, Zero Hour, the central debate and the bill votes.",
          link: { label: "Open Control", href: "/yip/dashboard/events/:eventId/control" },
        },
        {
          action: "Run **Question Hour** — the console shows each question, who asked it, and the ministry to answer.",
          detail: "Tap **Mark Answered** when done. The queue is the questions you approved earlier.",
        },
        {
          action: "Run **Zero Hour** — students raise urgent matters via **Raise a Motion**; review them in the **Motions** tab.",
          link: { label: "Open Motions", href: "/yip/dashboard/events/:eventId/motions" },
        },
        {
          action: "Run **Bill Presentation & Voting** — each committee presents and the house votes Aye/No.",
          detail: "The reveal shows BILL PASSED or BILL REJECTED.",
          link: { label: "Open Bills", href: "/yip/dashboard/events/:eventId/bills" },
        },
        {
          action: "After the National Anthem, tap **Complete Event**.",
          tip: "Computing and publishing the leaderboard is done by the super-admin (see Jury & scoring oversight), not from here.",
        },
      ],
    },
    {
      id: "elections-and-voting",
      title: "Elections & voting",
      steps: [
        {
          action: "Run all voting from the **Digital Voting** card on the Control Panel.",
          detail: "The moment you open a vote, an orange **VOTE NOW** card appears on every eligible student's phone.",
          link: { label: "Open Control", href: "/yip/dashboard/events/:eventId/control" },
        },
        {
          action: "Speaker election: Open → students vote → **Close Voting** → **Reveal Results**.",
          detail: "You see a live tally during voting that students can't.",
        },
        {
          action: "Party-leader elections: tap **Hold Election** per party, pick 3–5 nominees, Open → only that party votes → Close → Reveal.",
        },
        {
          action: "Bill votes: tap **Open Bill Vote**; students choose Aye / Nay / Abstain; Close → Reveal shows the result.",
        },
        {
          action: "Tie? A banner offers **Open 60-second runoff** — only tied candidates, everyone votes again.",
          tip: "**Known quirk:** after Open / Close / Reveal the panel sometimes doesn't update. **Refresh the page** — the action already happened. **Do not click the button twice.**",
        },
        {
          action: "Students without phones: use the **roll-call list** or a volunteer's **Vote Kiosk**.",
          detail: "A wrong entry can be fixed with **Correct Vote** — a reason is required and logged.",
        },
      ],
    },
    {
      id: "chat-moderation",
      title: "Chat moderation",
      steps: [
        {
          action: "Open the **Chat** tab — your moderation console.",
          detail: "Every organiser is a moderator. Agree who watches it during each session.",
          link: { label: "Open Chat", href: "/yip/dashboard/events/:eventId/chat" },
        },
        {
          action: "Use **Channels** to read any channel, **Delete** a message, or **Freeze** a channel to stop posting.",
          detail: "One channel per party, one per committee, plus Announcements. Unfreeze when done.",
        },
        {
          action: "Watch the **Reported** queue — every message a student reports lands here.",
          detail: "Delete it and/or mute the sender. **Muted students** lists who's muted so you can unmute them.",
        },
        {
          action: "Use the **Announcements** composer for schedule changes and 'results in 10 minutes' calls.",
          detail: "Students can read Announcements but not post. There are **no student-to-student DMs** — only student-to-YUVA mentor DMs, which you oversee.",
          tip: "Brief students on Day 1: be respectful, organisers see everything, and the report button is there for a reason.",
        },
      ],
    },
    {
      id: "jury-and-scoring",
      title: "Jury & scoring oversight",
      steps: [
        {
          action: "Make sure jurors score on **their own phones** with email sign-in — never your login.",
          detail: "Each student is scored out of **/100**: six juror components total 90, plus an automatic position bonus (max 10) the system adds for leadership roles.",
        },
        {
          action: "Chase any juror who is behind **before** the next session starts.",
          detail: "Jurors can only score the **current** session and the **immediately-previous** one, so they shouldn't fall behind.",
        },
        {
          action: "If the hall Wi-Fi drops, let jurors keep scoring — their phones sync automatically when it's back.",
          tip: "Don't panic over a 'syncing' badge.",
        },
        {
          action: "When all scoring is done, turn **Scores locked** ON in Control.",
          detail: "This blocks all jury submissions. Unlock it if a juror still needs to finish.",
          link: { label: "Open Control", href: "/yip/dashboard/events/:eventId/control" },
        },
        {
          action: "Leave computing and publishing the leaderboard to the super-admin.",
          detail:
            "The Scoring and Results dashboards, and the **Compute / Publish** steps, are **super-admin only**. As an organiser your job is to lock scoring at the right moment — the super-admin produces the leaderboard, awards and certificates.",
        },
      ],
    },
    {
      id: "troubleshooting",
      title: "Troubleshooting & who to contact",
      steps: [
        {
          action: "Golden rule: refresh first, fully close-and-reopen second, call the tech-on-call if it's still blocking.",
          detail: "The tech-on-call and event admin are on your cover sheet.",
        },
        {
          action: "Open/Close/Reveal did nothing? Refresh — the action already went through. Don't click again.",
        },
        {
          action: "A device looks stale, or VOTE NOW didn't appear? Have the student reopen the app and confirm the vote is open in Control.",
          detail: "If they installed the app, have them fully close and reopen it. Otherwise capture the vote via roll-call / kiosk.",
        },
        {
          action: "Can't log in with a code? Re-check the 6 characters (`0` vs `O`, `1` vs `I`).",
          detail: "Volunteers with an empty code field can't log in — set one.",
        },
        {
          action: "Locked out or forgot password? Ask the tech-on-call to reset it — passwords can't be looked up.",
        },
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
  journey: [
    "Join with your code",
    "Open your dashboard",
    "Ask & debate",
    "Vote on the floor",
    "Your certificate",
  ],
  sections: [
    {
      id: "join-with-your-code",
      title: "Join with your code",
      steps: [
        {
          action: "Bring your phone, **fully charged**, on both days.",
          detail: "Everything — voting, questions, chat — happens on it. No email or password needed.",
        },
        {
          action: "Go to the **Join** page and type the 6-character access code printed on your badge.",
          detail: "Type it into the **Your Access Code** box, then tap **Enter Parliament**.",
          tip: "Lost your badge? The registration desk has your code.",
          link: { label: "Go to Join", href: "/yip/join" },
        },
        {
          action: "If asked, tap **Install Yi Connect** so it opens like a real app.",
          tip: "No phone? No problem — a YUVA volunteer or organiser will record your vote for you.",
        },
      ],
    },
    {
      id: "your-dashboard",
      title: "Your dashboard",
      steps: [
        {
          action: "Open **My Dashboard** to see your role, party, school and constituency.",
          detail: "The **Live Now** card tells you what the house is doing right now — it updates by itself.",
          link: { label: "Open My Dashboard", href: "/yip/me" },
        },
        {
          action: "Check **Your party roster** and **Your YUVA & Yi Contact** cards.",
          detail: "The roster lists your party members; the contact card shows who's there to help you.",
        },
        {
          action: "Open **My Journey** any time to see your progress through the event.",
          link: { label: "Open My Journey", href: "/yip/me/journey" },
        },
      ],
    },
    {
      id: "ask-a-question",
      title: "Ask a Question (Question Hour)",
      steps: [
        {
          action: "Open **Questions** and tap **Submit** before the event.",
          detail: "Organisers approve questions; if yours is approved you may be called to ask it live.",
          link: { label: "Open Questions", href: "/yip/me/questions" },
        },
        {
          action: "Write your question (at least **20 characters**) and pick the **ministry** it's for.",
        },
        {
          action: "Submit up to **3 questions** — don't wait for the deadline.",
          tip: "Submissions close before the event starts.",
        },
      ],
    },
    {
      id: "debate-and-motions",
      title: "Debate & raising a motion",
      steps: [
        {
          action: "During **Zero Hour**, open **Raise a Motion** from your dashboard.",
          detail: "You can raise an urgent public matter for the house.",
          link: { label: "Open Motions", href: "/yip/me/motion" },
        },
        {
          action: "Write your urgent matter and submit it **before the deadline** shown.",
          tip: "If it's accepted, you may be called to speak.",
        },
      ],
    },
    {
      id: "draft-your-bill",
      title: "Draft your committee bill",
      steps: [
        {
          action: "If you're on a bill committee, open the **Committee Room** to write, discuss and amend your committee's bill.",
          detail: "Work it out together with your committee team.",
          link: { label: "Open Committee Room", href: "/yip/me/bill" },
        },
        {
          action: "Have **one** committee member upload the final bill.",
          tip: "Only the **first** person to submit locks the bill for the whole committee — agree who uploads, so you don't clash. Later, the whole house votes on it.",
        },
      ],
    },
    {
      id: "leadership-roles",
      title: "If you hold a leadership role",
      steps: [
        {
          action: "**Speaker / Deputy Speaker** — open the **Speaker's Desk** to admit or reject motions and run No-Confidence votes.",
          detail: "When you admit a No-Confidence motion, tap **Open floor vote** so the whole house votes on their phones, watch the live tally, then **Reveal result**.",
          link: { label: "Open Speaker's Desk", href: "/yip/me/speaker" },
        },
        {
          action: "**Minister / PM / Deputy PM** — open the **Ministry Desk** to answer the questions and motions directed to your ministry.",
          link: { label: "Open Ministry Desk", href: "/yip/me/ministry" },
        },
        {
          action: "**Leader of Opposition** — open the **Opposition Desk** to move a No-Confidence motion and respond to government bills.",
          link: { label: "Open Opposition Desk", href: "/yip/me/opposition" },
        },
        {
          action: "Don't hold one of these roles? You won't see these desks — that's normal.",
        },
      ],
    },
    {
      id: "voting",
      title: "Voting on the floor",
      steps: [
        {
          action: "When the orange **VOTE NOW** card appears, tap it.",
          detail: "It pops up the moment a vote opens — a Speaker election, your party-leader election, a bill vote, or a No-Confidence motion.",
          link: { label: "Open Vote", href: "/yip/me/vote" },
        },
        {
          action: "Pick your choice — you'll see **'Your vote has been recorded.'**",
          detail: "Vote **once** — that's your ballot.",
          tip: "No phone, or it's not working? A YUVA volunteer captures your vote — you still pick your own choice.",
        },
      ],
    },
    {
      id: "chat-rules",
      title: "Chat rules",
      steps: [
        {
          action: "Open **Chat** to reach your **party** channel and your **committee** channel.",
          detail: "There's also a read-only **Announcements** channel — read it, schedule changes land there.",
          link: { label: "Open Chat", href: "/yip/me/chat" },
        },
        {
          action: "Need help privately? Use **Message a YUVA mentor**.",
          detail: "There are **no student-to-student DMs**.",
        },
        {
          action: "Be respectful — organisers see every message.",
          tip: "See something off? Use the **report** button; don't reply to it. Misuse gets your messages deleted and you muted.",
        },
      ],
    },
    {
      id: "certificate-and-help",
      title: "Your certificate & getting help",
      steps: [
        {
          action: "After results are published, open **My Journey** to see how you did.",
          detail: "A participation (or award) certificate is generated for you.",
          link: { label: "Open My Journey", href: "/yip/me/journey" },
        },
        {
          action: "Share how the event went on the **Feedback** page.",
          link: { label: "Share Feedback", href: "/yip/me/feedback" },
        },
        {
          action: "If something looks stuck, fully **close and reopen** the app — don't just refresh.",
          tip: "Still stuck? Show a YUVA volunteer or organiser.",
        },
      ],
    },
  ],
};

const volunteer: PersonaGuide = {
  persona: "volunteer",
  title: "YUVA Volunteer Guide",
  tagline:
    "You run a desk — check your students in across both days, mark their speeches, follow the house live, and capture votes from anyone without a phone.",
  pdfPath: "/yip/guides/volunteer.pdf",
  journey: [
    "Log in with your code",
    "Open your desk",
    "Check students in",
    "Mark speeches & capture votes",
  ],
  sections: [
    {
      id: "what-a-yuva-does",
      title: "What a YUVA does",
      steps: [
        {
          action: "You run a **desk** for your assigned party (and committee). Your dashboard has four tabs: **Desk**, **Now**, **Students**, and **Vote**.",
          detail: "Check your students in each day, mark when they finish their 90-second speech, follow the live agenda, and capture votes from students without a phone.",
          link: { label: "Open your desk", href: "/yip/volunteer" },
        },
      ],
    },
    {
      id: "log-in",
      title: "Log in with your code",
      steps: [
        {
          action: "Go to the **Join** page and type your **own 6-character access code** into the **Your Access Code** box.",
          detail: "It is **not** a student code — the organisers give you your own. Then tap **Enter Parliament**.",
          link: { label: "Go to Join", href: "/yip/join" },
        },
        {
          action: "Confirm your screen shows your **Desk** — your assigned party/committee and your responsibilities.",
          tip: "If it says you have no desk, ask an organiser to assign you on the **YUVA Desks** page.",
        },
      ],
    },
    {
      id: "your-desk",
      title: "Your desk: attendance & speeches",
      steps: [
        {
          action: "Open the **Students** tab to see the students at your desk.",
          detail: "Mark each student in on **Day 1** and **Day 2** as they arrive — tap the day toggle next to their name.",
          link: { label: "Open Students", href: "/yip/volunteer" },
        },
        {
          action: "When a student finishes their **90-second speech**, tap **Speech** to mark it done.",
          tip: "Only the students at your desk show here — that's correct.",
        },
        {
          action: "Use the **Now** tab to follow what's happening in the house live.",
        },
      ],
    },
    {
      id: "run-the-kiosk",
      title: "Run a voting kiosk",
      steps: [
        {
          action: "When the organisers open a vote, your screen **wakes up by itself** — no refresh needed.",
          link: { label: "Open Kiosk", href: "/yip/volunteer" },
        },
        {
          action: "Find the student — search the list by serial number or name and tap them.",
          tip: "If a student already voted on their own phone, the list tells you — they can't vote twice.",
        },
        {
          action: "Hand them the phone so they pick their own choice, then tap **Confirm**.",
          detail: "The screen returns to the list for the next student.",
        },
        {
          action: "When voting closes, leave the screen on 'Waiting…' for the next vote.",
        },
      ],
    },
    {
      id: "etiquette",
      title: "Rules of the booth",
      steps: [
        {
          action: "One student at a time — **the student picks, never pick for them**.",
          detail: "The ballot is secret and the student decides.",
        },
        {
          action: "Don't announce or discuss anyone's choice.",
        },
        {
          action: "Made a mistake? Tell an organiser immediately — don't try to fix it yourself.",
          tip: "They can correct a vote with a logged reason.",
        },
      ],
    },
    {
      id: "helping-students",
      title: "Helping students & messages",
      steps: [
        {
          action: "Between votes, help students log in and point them to the **Live Now** card.",
          detail: "Login typos are usually `0` vs `O` and `1` vs `I` — codes are on their badges.",
        },
        {
          action: "Students can message you via **'Message a YUVA mentor'**, but you **can't reply in the app**.",
          detail: "Handle it in person or pass it to an organiser.",
          tip: "Anything worrying in a message (bullying, a student in distress) → straight to an organiser.",
        },
        {
          action: "If your screen looks stuck, fully close and reopen the app, then log in again with your code.",
        },
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
  journey: [
    "Sign in with email",
    "Learn the rubric",
    "Score each speaker",
    "Check your history",
  ],
  sections: [
    {
      id: "sign-in",
      title: "Signing in with email",
      steps: [
        {
          action: "Go to **Jury Sign-in** and sign in with the **email the organisers registered for you**.",
          detail: "You score on **your own phone** — never an organiser's login.",
          link: { label: "Go to Jury Sign-in", href: "/yip/jury/login" },
        },
        {
          action: "Land on the scoring screen and you're ready.",
        },
      ],
    },
    {
      id: "the-rubric",
      title: "The /100 workbook rubric",
      steps: [
        {
          action: "Score **six components** on the official **Yi 2026 Evaluation Workbook**.",
          detail: "Each appears in its own session as the event reaches it. Together your six total **90**.",
          link: { label: "Open Scoring", href: "/yip/jury" },
        },
        {
          action: "MUPI / Opening Speech (15) — research, relevance to the Central Agenda, and delivery.",
        },
        {
          action: "Question Hour (20) — quality of the question asked, or of the minister's answer.",
        },
        {
          action: "Zero Hour (15) — how well they raise and argue an urgent matter.",
        },
        {
          action: "Political Acumen (10) — coalition building, strategy, negotiation, floor presence.",
        },
        {
          action: "Committee (15) and Bill Presentation (15) — committee contribution, and presenting and defending the bill.",
        },
        {
          action: "Never add the last 10 (Position Points) yourself.",
          tip: "The system adds Position Points (max 10) automatically for leadership roles.",
        },
      ],
    },
    {
      id: "scoring-a-speaker",
      title: "Scoring a speaker",
      steps: [
        {
          action: "Watch the current speaker — they appear on your screen automatically.",
          detail: "The screen follows the house; the session you're scoring switches by itself when the house moves on.",
          link: { label: "Open Scoring", href: "/yip/jury" },
        },
        {
          action: "Score them against the component for the current session.",
          detail: "Need someone specific? Search by number, constituency, or name.",
        },
        {
          action: "Finish the previous session after the house advances if you need to.",
          tip: "You can only go **one** session back, so don't fall more than a session behind. You can edit a score until scoring is locked.",
        },
      ],
    },
    {
      id: "offline-and-sync",
      title: "Offline scoring & sync",
      steps: [
        {
          action: "If the hall Wi-Fi drops, keep scoring exactly as normal.",
          detail: "Your scores are saved on your phone and **sync automatically** when the connection returns.",
          tip: "A small sync badge shows the status — ignore it and keep going.",
        },
        {
          action: "If something looks stuck, fully close and reopen the tab or app, then sign in again.",
          detail: "Your submitted scores are safe.",
        },
      ],
    },
    {
      id: "your-history",
      title: "Your scoring history",
      steps: [
        {
          action: "Open **History** to confirm you haven't missed anyone before the next session starts.",
          detail: "It lists every score you've already submitted.",
          link: { label: "Open History", href: "/yip/jury/history" },
        },
      ],
    },
    {
      id: "fairness-rules",
      title: "Fairness rules",
      steps: [
        {
          action: "Don't share scores aloud — angle your screen away.",
          detail: "Your scores feed a shared leaderboard, so discretion matters.",
        },
        {
          action: "Score **every** student you observe in a session — gaps hurt the leaderboard's fairness.",
        },
        {
          action: "Unsure about a rubric line? Quietly ask an organiser between sessions, not mid-speech.",
        },
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
