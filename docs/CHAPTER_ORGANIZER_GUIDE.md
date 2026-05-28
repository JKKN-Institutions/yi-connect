# YIP Chapter Organizer Guide

**For:** Chapter Chairs and Chapter EMs running a YIP (Young Indians Parliament) chapter round
**Platform:** https://yi-connect-app.vercel.app/yip
**First live deployment:** Mizoram Chapter Round — 4–5 June 2026

---

## Table of contents

1. [Welcome](#1-welcome)
2. [Before the event — Setup checklist](#2-before-the-event--setup-checklist)
3. [Adding participants](#3-adding-participants)
4. [Adding jury](#4-adding-jury)
5. [Picking topics](#5-picking-topics)
6. [Going live — Control panel](#6-going-live--control-panel)
7. [Scoring](#7-scoring)
8. [After the rounds — Results](#8-after-the-rounds--results)
9. [What you CANNOT do](#9-what-you-cannot-do)
10. [Troubleshooting](#10-troubleshooting)
11. [Glossary](#11-glossary)

---

## 1. Welcome

YIP — the Young Indians Parliament — gives Class 9–12 students two days inside a working simulation of the Indian Parliament: Speaker, Prime Minister, Cabinet, ruling and opposition benches, real committee topics, real bills, real motions, and a jury that scores them like the real thing. You already know how to run this on paper. This guide shows you how to run it on the platform — start to finish — without needing to ask anyone for help.

Mizoram on 4–5 June 2026 is the first chapter to run YIP fully on this platform. Everything in this guide has been built against that round.

> 💡 **Tip:** Read sections 1 to 5 a week before the event. Read sections 6 to 8 the morning of Day 1. Keep the [Quick Reference](./CHAPTER_ORGANIZER_QUICK_REFERENCE.md) printed and on your table during the event.

---

## 2. Before the event — Setup checklist

### 2.1 Get your chapter admin login

The Yi National team creates a login for each chapter from the super-admin Chapter Admins page. You will receive:

- An **email address** the login is attached to (your Yi/CII email is recommended)
- A **login slug** that looks like `mizoram-1`, `bangalore-2`, `chennai-1` — your chapter name in lowercase, hyphen, a number
- A **magic-link email** in your inbox the moment your login is created

> 📷 SCREENSHOT: Sample magic-link email from Supabase Auth showing "Sign in to Yi Connect"

You do **not** receive a password. The platform uses magic-link sign-in, which means a fresh link gets emailed to you every time you sign in. This is by design — no password to lose, no password to share, no password to rotate.

> ⚠️ **Warning:** Do NOT forward your magic-link email to anyone else. Anyone with that link can sign in as you for up to 1 hour. If a National team member needs to help you, ask them to "see as me" from their admin panel — they have a built-in way to do it safely.

### 2.2 First login

1. Open **https://yi-connect-app.vercel.app/yip/login** in your browser.
2. Enter your email (the same one the National team registered).
3. Click **Send magic link**.
4. Open your inbox, click the magic link.
5. You land on the **Dashboard**.

> 📷 SCREENSHOT: /yip/login page with email field and "Send magic link" button
> 📷 SCREENSHOT: /yip/dashboard landing page showing event list (empty on first login)

If the magic link does not arrive within 2 minutes, check your spam folder. If it is not there either, see [Troubleshooting](#10-troubleshooting).

### 2.3 Create your chapter event

1. From the dashboard, click **+ New Event** (top right).
2. Fill in:
   - **Event name** — e.g. `Mizoram Chapter Round 2026`
   - **Level** — pick `chapter` (not regional, not national)
   - **Chapter** — pick yours from the dropdown
   - **Start date** — first day of the round (e.g. `2026-06-04`)
   - **End date** — last day (e.g. `2026-06-05`)
   - **Venue** — e.g. `Aizawl Convention Centre`
   - **Year** — pick the active YIP year (e.g. `2026`)
3. Click **Create**.

> 📷 SCREENSHOT: /yip/dashboard/events/new form filled in with Mizoram example

You land on the **Event overview page** at `/yip/dashboard/events/[id]`.

### 2.4 What happens automatically — central topics auto-attach

The moment you create a chapter event, the platform looks up the 20 indicative central topics published by the Yi National team for the current YIP year and links every single one of them to your event. You do not need to fetch, paste, or upload anything.

> 💡 **Tip:** This is feature K (auto-inherit central topics). If you ever see only some topics attached, see [Troubleshooting](#10-troubleshooting) — the National team can re-push centrals to all chapters with one click.

You will pick 5 of these 20 topics in section 5.

### 2.5 Setup checklist (use this before Day 1)

- [ ] Chapter admin login received from National team
- [ ] Magic link tested — you can sign in
- [ ] Event created with correct dates, venue, level, year
- [ ] 20 central topics visible on the Topics tab
- [ ] Roster `.xlsx` file ready (8 columns — see section 3.2)
- [ ] Jury list ready (names + emails)
- [ ] Projector + screen tested in the hall
- [ ] Stable wifi at the venue
- [ ] National team tech contact saved in your phone

---

## 3. Adding participants

This is the single biggest data-entry job. The platform supports both bulk upload (recommended) and one-by-one manual entry.

### 3.1 Bulk upload — recommended

1. Go to your event → **Participants** tab.
2. Click **Import roster**.
3. Click **Download template (.xlsx)** if you don't have one yet — this gives you the exact column headers the importer expects.
4. Fill the template with all your students (see section 3.2).
5. Drag the filled `.xlsx` file onto the upload box, or click **Choose file**.
6. The platform reads the file in your browser, shows you a preview of the first few rows, and tells you if any rows have problems (missing name, bad email, missing school).
7. Fix problems in the `.xlsx` and re-upload, or click **Import** to push the clean rows.

> 📷 SCREENSHOT: Participants page → Import roster modal with file picker and "Download template" button
> 📷 SCREENSHOT: Import preview table showing rows with green/red status indicators

> 💡 **Tip:** You can upload `.xlsx` (Excel) directly. You don't have to convert to `.csv` first. This is feature F6.

### 3.2 The XLSX column format

The importer reads these column headers (case-insensitive, exact spelling matters):

| Column header | Required? | Example | Notes |
|---|---|---|---|
| `name` | Yes | `Anita Sharma` | Student's full name |
| `school` | Yes | `Mizoram Higher Secondary School` | Matched against `yi.institutions` |
| `class` | Yes | `11` or `12` | Class 9-12 only |
| `phone` | Yes | `9876543210` | 10 digits, no country code |
| `email` | Recommended | `anita@example.com` | Used for student `/yip/me` access |
| `city` | Recommended | `Aizawl` | |
| `party` | Optional | `A` | Single letter A–E — see section 3.4 |
| `constituency` | Optional | `Aizawl North` | The constituency this student represents |
| `state` | Optional | `Mizoram` | If `party`/`constituency` is present, this is treated as the constituency's state |
| `committee` | Optional | `1`–`5` | Committee number 1 to 5 |

> ⚠️ **Warning:** Header spelling must match. `school_name` works (it's a known alias). `Studentname` does not. If a column is rejected, check the template you downloaded — those are the canonical headers.

You can upload the file **with** allocation columns (party / constituency / committee filled in) or **without** them. If you upload without, you allocate inside the platform later (see section 3.4).

### 3.3 Manual entry

If you only have 5 or 10 students to add (a stretch case or a late addition), use **+ Add participant** on the Participants tab. Same fields, one at a time.

> 💡 **Tip:** Bulk upload wins for 30+ students. Manual entry wins for 5 or fewer, or for fixing a typo in one row.

### 3.4 The 5-party model

YIP runs 5 parties: **A, B, C, D, E**. By default:

- **Party A** = ruling party (the government, the side that introduces bills)
- **Parties B, C, D, E** = opposition

The moment your first participant is assigned to a party letter (whether through the `.xlsx` upload or inside the Parties tab), the platform auto-creates the 5 party rows for your event — you do not have to create them by hand.

> 📷 SCREENSHOT: Parties tab showing 5 rows (A, B, C, D, E) with a "Ruling" toggle on Party A

If you want a different party to be ruling (e.g. for a teaching round where Party B forms government), open the **Parties tab** and toggle the **Ruling** flag. Only one party can be ruling at a time. This is feature P2.

---

## 4. Adding jury

### 4.1 Frictionless jury login — recommended

This is the simplest path for a new jury and the way Mizoram is running it.

1. Go to your event → **Jury** tab.
2. Click **+ Add juror**.
3. Enter the juror's **email** and **full name**.
4. (Optional) Pick which committees they will score for.
5. Click **Save**.
6. Repeat for every juror.
7. Share **https://yi-connect-app.vercel.app/yip/jury/login** with all jurors — over WhatsApp, email, or print on the badge.

When a juror visits that URL, they:

1. Enter their email.
2. See a dropdown of events they have been added to.
3. Pick your event.
4. Land directly in the scoring UI.

No password. No access code. No magic link to click. They are pre-allowed because you added them on the Jury tab. This is feature D.

> 📷 SCREENSHOT: /yip/jury/login page with email field
> 📷 SCREENSHOT: Same page after email entry, showing event dropdown
> 📷 SCREENSHOT: Jury scoring UI after event selection — rubric with sliders and Remarks toggles

> 💡 **Tip:** Test this once yourself with a personal email before the event — sign in as a "test juror", make sure you reach the scoring screen, then remove yourself.

### 4.2 Legacy access-code login

If a juror cannot receive email at the venue (rural wifi, locked corporate inbox), the older 6-character access-code path still works:

1. On the Jury tab, click the juror's row → **Generate access code**.
2. A 6-character code (e.g. `7K2P9X`) appears.
3. Give it to the juror.
4. They visit **/yip/jury/login**, click **Use access code instead**, enter the code.

> 🚫 **You can't:** Generate access codes in bulk. They are one-by-one to prevent accidental leakage.

---

## 5. Picking topics

Every chapter event must pick **exactly 5** committee topics from the 20 central topics — one per committee. The platform refuses to let you go live with anything other than exactly 5. This is feature F2.

### 5.1 The Topics tab

1. Go to your event → **Topics** tab.
2. You see 20 central topics already attached (from section 2.4).
3. Tick the checkbox next to each topic you want to use.
4. Watch the counter at the top: it shows `X / 5 selected`.
5. **Save** is greyed out until the counter reads exactly `5 / 5`.
6. Click **Save**.

> 📷 SCREENSHOT: Topics tab with 20 rows, 5 ticked, counter showing "5 / 5 selected" and Save button enabled

### 5.2 What committee gets what topic

Each of the 5 topics maps to one of 5 committees (Committee 1 to Committee 5). The order you tick the topics is the order they get assigned to committees — first tick = Committee 1, second tick = Committee 2, etc.

> 💡 **Tip:** Tick in the order you want them announced to the students. You can re-order on the same page before saving.

> ⚠️ **Warning:** Once participants are allocated to committees and the event is live, changing topics is disruptive. Lock topics down before Day 1.

---

## 6. Going live — Control panel

The **Control panel** at `/yip/dashboard/events/[id]/control` is the cockpit. You drive the event from here on Day 1 and Day 2.

> 📷 SCREENSHOT: Full control panel layout showing Timer, Agenda state, Positions card, Broadcast section, and live counts

### 6.1 Assigning parliamentary positions

YIP has 6 roles. Assign one student to each:

| Role | Bonus | Notes |
|---|---|---|
| **Prime Minister** | +5 | One student, ruling party |
| **Speaker of the House** | +3 | Neutral chair, picks who speaks next |
| **Deputy Speaker** | +2 | Stands in when Speaker steps down |
| **Leader of Opposition** | +3 | Lead voice for opposition parties |
| **Cabinet Minister** | +2 | One per ministry — up to 5 |
| **Member of Parliament (MP)** | 0 | Everyone else |

This is feature F3.

To assign:

1. Open the **Positions** card on the control panel.
2. For each role, pick a participant from the dropdown.
3. The assignment saves the moment you pick.

> 📷 SCREENSHOT: Positions card with all 6 role dropdowns populated

> 💡 **Tip:** Bonus points are added automatically to the student's final score when results are computed — you do not have to remember or apply them by hand.

> ⚠️ **Warning:** The bonus values above are the platform defaults. The Yi National team can change them centrally before your event if Swapnil/Pradeep have adjusted them.

### 6.2 The timer and agenda state machine

The platform runs a **shared timer** synced from the server. Every screen — yours, the jury's, the students', the projector — shows the same countdown. When you start the timer on the control panel, all screens start counting down simultaneously.

The **agenda** is a state machine. The event moves through stages: `setup → opening → committee_1 → committee_2 → committee_3 → committee_4 → committee_5 → closing → results`. Advancing the agenda from one stage to the next is a button click on the control panel. When you advance, the projector, the jury UI, and the student UI all update to reflect the new stage.

> 📷 SCREENSHOT: Agenda card showing current stage highlighted and "Advance to next" button

> 💡 **Tip:** Don't advance the agenda until the current stage is genuinely over. The jury's scoring screen filters who they can score by the current committee — if you advance early, you cut off scoring for that committee.

### 6.3 The breaking-news banner

You can push a live banner across the projector at any moment — for "Recess called", "Quorum lost", "Bill X passed", "Lunch at 1pm", or anything urgent. This is feature F5.

1. On the control panel, find the **Broadcast** section.
2. Type your message in the text box.
3. Click **Push**.
4. Within 1 second, the message appears as a marquee at the top of the projector screen.
5. Click **Clear** when the message is no longer relevant.

> 📷 SCREENSHOT: Broadcast section with text input and Push/Clear buttons
> 📷 SCREENSHOT: Projector display with breaking-news banner scrolling at the top

> ⚠️ **Warning:** The banner is visible to the entire hall. Triple-check spelling before pushing — there is no edit-after-push, only Clear and re-Push.

---

## 7. Scoring

You as Chapter Chair don't usually score yourself — the jury does. But you should know how the scoring flow works so you can answer juror questions on the day.

### 7.1 Speech and rotation

- Each student gets a **90-second speech** on the floor.
- The jury rotates students by constituency lookup — they search for the student by constituency name or scroll the list.
- The jury rates the student on the role-specific **rubric** (criteria like content, delivery, argumentation, decorum — the exact criteria are configured per YIP year).

### 7.2 Special Remarks (the 4 toggles)

Below the rubric, the jury sees 4 toggles. These are feature F4 — they capture parliamentary actions that warrant points beyond the rubric.

| Toggle | Default impact | What it means |
|---|---|---|
| **No Confidence Brought** | **+3** | This student moved a no-confidence motion. Rewards initiative. |
| **Walkout** | **−5** | This student walked out of the house. Penalty. |
| **Ruckus** | **−3** | This student caused a ruckus. Penalty. |
| **Suspension** | **−10** | This student was suspended by the Speaker. Severe penalty. |

> 📷 SCREENSHOT: Jury scoring UI Remarks section with 4 toggle switches

> 💡 **Tip:** Brief the jury before Day 1 on what each of these means in YIP rules — especially "No Confidence Brought" (it's a positive, not a negative, despite sounding dramatic).

### 7.3 Constituency-based participant lookup

When a juror needs to score the student who just spoke, they search by constituency — e.g. `Aizawl North` — and the matching student appears. This is why the constituency column in your `.xlsx` upload (section 3.2) matters: it is the jury's primary key for finding people fast under time pressure.

---

## 8. After the rounds — Results

### 8.1 Lock scores

Once the last committee finishes scoring on Day 2:

1. On the control panel, click **Lock scores**.
2. Confirm in the dialog.
3. Jury scoring UI shows "Scoring closed" — no more edits possible.

> 📷 SCREENSHOT: Control panel Lock scores button with confirmation dialog

> ⚠️ **Warning:** Once locked, only the Yi National team can unlock. Lock only when you are sure no juror has pending scores to submit.

### 8.2 Compute results

1. Click **Compute results** on the control panel.
2. The platform runs the calculation:
   - **Base score** = sum of jury rubric scores
   - **+ Position bonus** (from section 6.1) — auto-added
   - **+ Special remarks deltas** (from section 7.2) — auto-summed
3. Results page populates with the final ranked list.

> 📷 SCREENSHOT: Results page showing ranked participants with base / bonus / flags / final columns

### 8.3 Publishing — what students see at `/yip/me`

Each student logs into **/yip/me** (with their email or access code) and sees their **own** result card:

- Their final score
- Which awards they won (if any)
- Their position bonus and flag deltas (if any)
- A printable participation certificate

> 📷 SCREENSHOT: /yip/me result page from a student's perspective

### 8.4 The 15 awards

YIP recognizes 15 categories, awarded automatically based on the computed results. Examples:

1. **Best Speaker** — highest rubric score
2. **Best Prime Minister** — top PM by final score
3. **Best Leader of Opposition** — top LoP by final score
4. **Best Cabinet Minister** — top minister by final score
5. **Best Speaker of the House** — top Speaker by final score
6. **Best Bill Introduced**
7. **Best Motion Moved**
8. **Best Question Asked**
9. **Best Ruling Party Performance**
10. **Best Opposition Performance**
11. **Best Female Parliamentarian**
12. **Best First-Time MP**
13. **Most Improved (Day 1 → Day 2)**
14. **Spirit of Parliament**
15. **Overall Chapter Champion**

> 💡 **Tip:** Award names and rules can be tuned by the National team per year — check with them if the list above is missing or has extras for your year.

> 📷 SCREENSHOT: Awards section of the results page showing each award with the winning student

---

## 9. What you CANNOT do

The platform deliberately prevents a chapter admin from doing things that would damage the larger YIP system. Some of this list will feel restrictive — that is intentional.

> 🚫 **You can't:** Delete participants. Only the Yi National super-admin team can remove a participant row. If a student withdraws, mark them as inactive on the Participants tab.

> 🚫 **You can't:** Delete parties. The 5 parties (A–E) auto-exist for every chapter event and cannot be removed.

> 🚫 **You can't:** Delete events. Even your own. Contact the Yi National tech contact if an event was created in error.

> 🚫 **You can't:** Wipe all mock data. The "Wipe All Mock Data" button on the admin panel only exists for super-admins running demos.

> 🚫 **You can't:** Edit the rubric. The scoring rubric is set centrally by Yi National per YIP year.

> 🚫 **You can't:** Change another chapter's data. Your login is scoped to your chapter only.

> 🚫 **You can't:** Override position bonus values for a single student. The bonus is computed from their parliamentary role; it cannot be hand-tuned.

This protects every chapter from accidentally wiping another's data. If you genuinely need any of these actions, contact the Yi National tech contact (see [Quick Reference](./CHAPTER_ORGANIZER_QUICK_REFERENCE.md)).

---

## 10. Troubleshooting

### My magic link did not arrive

1. Wait 2 minutes — magic links sometimes take a moment.
2. Check spam / junk folder.
3. Verify the email address with the National team — typo in `mzo` vs `mizo` happens.
4. Ask National team to resend or to "see as me" so they can debug your login.

### I see only 5 central topics on my Topics tab, not 20

This means the auto-attach didn't run (feature K is meant to attach all 20, see section 2.4). Ask the National team to use the **Push central topics to all chapter events** button on `/yip/dashboard/admin/topics` — this re-pushes the full 20 to every chapter event in one click. This is feature F7.

### A juror cannot find their event on the jury login dropdown

This means they were not added to your Jury tab. Go to your event → Jury → **+ Add juror** → enter their email → save. They refresh `/yip/jury/login`, re-enter their email, the event will now appear.

### The XLSX import is rejecting all rows

Check the column headers. Download a fresh template from the Import Roster modal — your file likely has headers like `Student Name` (rejected) instead of `name` (accepted). See section 3.2 for the exact list.

### The timer is out of sync between projector and jury screens

Refresh both screens (F5 / pull-to-refresh). The timer is server-driven, so a refresh re-syncs everyone to the canonical time. If it persists, your venue wifi is dropping packets — switch to mobile hotspot.

### A participant is in the wrong party

Open the **Parties** tab → find the student in the wrong party → drag them (or use the dropdown) to the correct party. If the platform refuses (you've locked allocation), ask the National team to unlock briefly.

### The breaking-news banner is stuck

Click **Clear** on the Broadcast section. If it does not clear, refresh the projector page (F5). The banner is set by a database column — refresh always re-reads the truth.

### Scores are computed but a student's number looks wrong

Open the student's row in the Results page → click **View breakdown**. You will see: base score + position bonus + each flag delta. If any line item looks wrong:

- **Position bonus wrong** → fix the position assignment on the control panel, re-compute.
- **Flag delta wrong** → ask the relevant juror to unflag (they can if scores are not locked).
- **Base score wrong** → individual jury entry; ask the juror to re-score.

### Who to contact

- **Platform broken** — Yi National tech contact (your phone)
- **YIP rules / scoring policy** — Yi National YIP National Co-Chair (Swapnil Ansarwadekar)
- **Data wipe / restore needed** — Yi National super-admin (Pradeep Chenthilkumar)

---

## 11. Glossary

| Term | Meaning |
|---|---|
| **Access code** | Legacy 6-character code (e.g. `7K2P9X`) used by jurors who cannot use email login |
| **Agenda state** | The current stage of the event — `setup`, `committee_1`, `closing`, etc. — driven by the control panel |
| **Bonus points** | Extra marks added to a participant's final score based on their parliamentary role |
| **Central topics** | The 20 indicative committee topics published by Yi National each YIP year |
| **Chapter event** | A YIP round run by a single Yi chapter (vs regional, vs national) |
| **Committee** | One of 5 working groups in YIP — each takes one of the 5 picked topics |
| **`committee_number`** | The XLSX column that pre-allocates a student to a committee (1–5) |
| **Constituency** | The geographic seat a student represents in the simulated parliament |
| **`constituency_name`** | The XLSX column for the constituency a student represents |
| **`constituency_state`** | The state the constituency belongs to (vs the student's home state) |
| **Control panel** | The organiser's cockpit at `/yip/dashboard/events/[id]/control` |
| **Frictionless jury login** | Email-based passwordless login at `/yip/jury/login` — no link, no password, just email |
| **K (feature)** | Auto-inherit central topics on chapter event creation |
| **Level** | Event tier — `chapter`, `regional`, or `national` |
| **Login slug** | Chapter-named identifier (e.g. `mizoram-1`) used as alternative to email |
| **Magic link** | One-time sign-in link emailed to the user, valid for ~1 hour |
| **Mock data** | Seeded test data for demos — only super-admins can seed or wipe |
| **`parliament_role`** | A participant's assigned role — PM, Speaker, Deputy Speaker, LoP, Cabinet Minister, or MP |
| **Party A–E** | The 5 parties in YIP — A is ruling by default, B-E are opposition |
| **`party_letter`** | The XLSX column that pre-allocates a student to a party (single letter A–E) |
| **`party_side`** | Whether a party is `ruling` or `opposition` |
| **Position bonus** | Auto-added marks for parliamentary roles — PM +5, Speaker +3, etc. |
| **Projector display** | The public-facing screen at `/yip/event/[id]/display` shown to the audience |
| **Rubric** | Scoring criteria the jury uses — set centrally per YIP year |
| **Ruling party** | The party that forms government and introduces bills — defaults to Party A |
| **Special Remarks** | The 4 jury toggles — No Confidence Brought, Walkout, Ruckus, Suspension |
| **Year** | The YIP year (e.g. 2026) — drives which central topics auto-attach |

---

*Document version: 1.0*
*Last updated: 2026-05-28*
*For corrections, contact the Yi National team.*
