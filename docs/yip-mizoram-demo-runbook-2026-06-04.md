# YIP Mizoram Demo — Organizer Runbook (June 4, 2026)

**Event:** Mizoram Chapter Round 2026
**Platform:** https://yi-connect-app.vercel.app/yip
**Dates:** Day 1 — 4 June 2026 · Day 2 — 5 June 2026
**Audience:** Yi organizers running the demo. No technical knowledge needed — every step is a screen and a button.

> Print this, or keep it open on a second device during the demo. Each phase says **who logs in, where, and what to click**, with a fallback if something goes wrong. Exact button labels may differ slightly on screen — the **action** named in each step (Login, Import, Lock, Assign, Compute) is what to look for.

---

## The single most important setup rule

**One person "owns" this event, and only that owner can operate it** — import the roster, lock allocation, run the control panel, compute results. Everyone else is locked out of those controls (this is a safety feature). So:

- Decide **who will operate the demo from the laptop** before the day.
- That person logs in with **their own** organizer account, and the event must be set to **their** ownership. (This is already handled in setup — but if you change operators, the new operator must be set as owner first, or their buttons won't work.)
- Jury and the projector are separate and do **not** need to be the owner.

---

## Before the day — one-time setup checklist

Tick each the day before. If any is unchecked, the demo can stall.

- [ ] **Owner set** — the laptop operator is the event owner (so their controls work).
- [ ] **Roster uploaded** — 94 participants imported (creates students + 5 parties).
- [ ] **Allocation reviewed & locked** — every student has a party, constituency, committee.
- [ ] **Topics set** — exactly **5 central + 5 NER regional** topics (10 total).
- [ ] **Jury added** — every jury member's email is in the system.
- [ ] **Venue set** — real Aizawl venue name + address (replaces the "TBD" placeholder).
- [ ] **One full dry run** — log in as operator, as a jury member, and open the projector view, on the real devices.
- [ ] **Devices charged** — jury phones, operator laptop, projector laptop.
- [ ] **Network tested** — at the actual seats the jury will sit in.

---

## Who is logged in where (at a glance)

| Role | Device | Where to go | How they get in |
|------|--------|-------------|-----------------|
| **Operator (owner)** | Laptop | `/yip/login` | Organizer email + password |
| **Jury** | Their own phones | `/yip/jury/login` | Email → pick the event → score |
| **Projector** | Laptop wired to projector | `/yip/event/<event-id>/display/projector-display` | Public link, no login |
| **Students** (optional in a demo) | Phones | `/yip/join` | 6-character access code |

---

## Phase 1 — Operator login

1. On the laptop, go to **`yi-connect-app.vercel.app/yip/login`**.
2. Enter the operator's **email and password**, click **Sign in**.
3. You land on the **dashboard** (`/yip/dashboard`). Click **Mizoram Chapter Round 2026**.

**If you can't see the event, or the buttons don't work:** you're logged in as someone who is not the event owner. Use the owner's account, or have the owner set you as owner first. (The platform shows a clear "no access" page rather than a silent loop.)

---

## Phase 2 — Roster (already uploaded in setup; here's how, for reference)

> Skip on demo day if done in setup. **Only the event owner can import.**

1. Open **Participants** (`/yip/dashboard/events/<id>/participants`).
2. Click **Import Roster**.
3. Choose the participant spreadsheet. The importer reads these column names automatically: `name`, `school`, `class`, `party`, `constituency`, `state`, `committee` (plus optional `phone`, `email`, `city`).
4. Confirm the preview row count (94), then **Import**. Each student gets a unique 6-character access code automatically.

**Fallback:** if the upload errors, make sure the sheet has columns literally named **name** and **school** (those are required) and re-upload.

---

## Phase 3 — Allocation (review & lock)

1. Open **Allocation** (`/yip/dashboard/events/<id>/allocation`).
2. Because the roster already carries party/constituency/committee, students are pre-allocated. Review the party split (Party A = ruling, B–E = opposition) and committees.
3. To change one student, use the override dropdowns **before** locking.
4. Click **Lock allocation**.

**Why locking matters:** locking freezes assignments so scoring and roles line up. After locking, students can't be deleted and allocation can't be re-run (by design).

---

## Phase 4 — Topics (5 central + 5 regional)

1. Open **Topics** (`/yip/dashboard/events/<id>/topics`).
2. Pick **exactly 5 regional (NER) topics** and **5 central topics**. The page enforces the 5-regional rule for a chapter event — if you save with a different number of regional topics, it will ask you to fix it.
3. Save.

---

## Phase 5 — Control Panel (run the live session)

The Control Panel drives what everyone else sees.

1. Open **Control Panel** (`/yip/dashboard/events/<id>/control`).
2. **Assign positions** — assign **Speaker**, **Prime Minister**, and **Cabinet** to students.
3. **Advance the agenda** — move through items one at a time; this updates jury, students, and the projector in sync.
4. **Timer** — start the **90-second** timer per speaker. The countdown comes from the server, so every screen shows the same time.
5. **Lock** an agenda item when its speeches are done.
6. Changes **broadcast** live to all connected screens automatically.

**Fallback if a screen looks out of sync:** refresh that screen once — the state lives on the server, so a refresh re-syncs and loses nothing.

---

## Phase 6 — Jury scoring (on phones)

1. Each jury member opens **`yi-connect-app.vercel.app/yip/jury/login`** on their **phone**.
2. They enter their **email**, then **pick "Mizoram Chapter Round 2026"** from the dropdown.
3. They see the **current speaker** (driven by your Control Panel) and a scoring form.
4. They score against the rubric — **MPs are scored out of 110** (5 sections: Content 30, Communication 25, Conduct 30, Argumentation 15, Teamwork 10). They can flag **Special Remarks** (no-confidence, walkout, ruckus, suspension).
5. They **Submit** each score.

**Fallback if a jury phone won't log in:** confirm the email is exactly the one added to the event, and that they picked the right event. If a submit seems to do nothing, refresh and re-enter.

**Tip:** have each jury member do one practice submission before the real session.

---

## Phase 7 — Compute results

1. When a round's scoring is done, open **Results** (`/yip/dashboard/events/<id>/results`).
2. Click **Compute results**. Position bonuses (Speaker/PM/Cabinet) and party-flag adjustments are applied automatically — you don't add them by hand.

**Fallback:** if a jury member hasn't submitted, totals reflect only what's in. Chase the submission, then re-compute.

---

## Phase 8 — Results & Awards

1. On the **Results** page, review the **leaderboard** and the **awards**.
2. Review before announcing.

---

## Phase 9 — Projector view

1. On the projector laptop, open **`/yip/event/<event-id>/display/projector-display`** (public — no login).
2. Full-screen it and connect the projector.
3. It shows the live agenda, current speaker, and timer. Scores are **never** shown on the projector.

**Fallback:** if it freezes, refresh the tab — it re-connects to the live state.

---

## Emergency playbook

| Symptom | First thing to try | If that fails |
|---------|--------------------|---------------|
| A screen is out of sync | Refresh that screen | Refresh the Control Panel too |
| Jury can't log in | Verify exact email + correct event | Try a different phone/browser |
| Operator buttons greyed/denied | You're not the owner | Log in as the owner |
| Timer looks wrong on one device | Refresh that device | Server time is the source of truth — carry on |
| Need to delete something | Only the **event owner** can; not after allocation lock | Work around it; don't force it |
| WiFi drops | Switch to mobile hotspot | Submitted data is saved server-side |

**Golden rule:** the live state lives on the **server**, not on any one screen. A refresh almost never loses anything — reach for it before anything drastic.

---

## Key contacts on the day

- **Event owner / operator:** _[name + phone]_
- **Super-admin (can unblock access / ownership):** Director
- **Tech on call:** _[fill in]_
- **Venue contact:** _[fill in]_

---

*Runbook generated 2026-05-30 for the June 4 Mizoram demo. Routes and mechanisms verified against the live yi-connect codebase (HEAD 10d2b6b) and the 2026-05-30 dress rehearsal.*
