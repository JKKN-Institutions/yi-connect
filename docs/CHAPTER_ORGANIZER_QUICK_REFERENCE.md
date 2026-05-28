# YIP Chapter Organizer — Quick Reference

**Print this. Tape it to your laptop. Keep a copy on your tablet.**

For the full guide, see [CHAPTER_ORGANIZER_GUIDE.md](./CHAPTER_ORGANIZER_GUIDE.md).

---

## Login

- **URL:** `https://yi-connect-app.vercel.app/yip/login`
- **Login type:** Magic link emailed to you (no password)
- **Slug pattern:** `chapter-name-N` — e.g. `mizoram-1`, `chennai-2`, `bangalore-1`
- **Jury login URL:** `https://yi-connect-app.vercel.app/yip/jury/login`
- **Student login URL:** `https://yi-connect-app.vercel.app/yip/me`
- **Projector URL:** `https://yi-connect-app.vercel.app/yip/event/[event-id]/display`

---

## Event-day 6-step flow

1. **Sign in** at `/yip/login` → click magic link from email → land on dashboard.
2. **Open your event** → confirm 20 central topics attached, 5 picked, all participants imported, all jury added.
3. **Assign positions** on Control Panel → Positions card: PM, Speaker, Deputy Speaker, Leader of Opposition, Cabinet Ministers.
4. **Open projector** on the hall screen → `/yip/event/[id]/display`.
5. **Start timer + advance agenda** stage by stage from Control Panel. Push breaking-news banner as needed.
6. **After last committee:** Lock scores → Compute results → Publish. Students see results on `/yip/me`.

---

## Position bonus values

| Role | Bonus |
|---|---|
| Prime Minister | **+5** |
| Speaker | **+3** |
| Deputy Speaker | **+2** |
| Leader of Opposition | **+3** |
| Cabinet Minister | **+2** |
| Member of Parliament (MP) | 0 |

---

## Special Remarks (jury toggles)

| Toggle | Points |
|---|---|
| No Confidence Brought | **+3** |
| Walkout | **−5** |
| Ruckus | **−3** |
| Suspension | **−10** |

---

## XLSX upload — 10 column headers (case-insensitive)

```
name, school, class, phone, email, city, party, constituency, state, committee
```

- **Required:** `name`, `school`, `class`, `phone`
- **Recommended:** `email`, `city`
- **Optional (for pre-allocation):** `party` (A–E), `constituency`, `state`, `committee` (1–5)

Download a fresh template from the Import Roster modal if in doubt.

---

## What to do if X breaks

### 1. A juror cannot reach the scoring screen

- Check **Jury** tab → confirm they are added with the right email.
- Ask them to refresh `/yip/jury/login` and re-enter their email.
- Fallback: generate a 6-char access code from the Jury tab and give it to them.

### 2. The projector is showing stale data (old timer, old agenda)

- Press **F5** on the projector laptop to refresh.
- If still stale, check the venue wifi — switch to mobile hotspot if needed.
- The platform is server-driven, so a refresh always pulls the canonical state.

### 3. Topics tab shows fewer than 20 central topics

- Ask Yi National team to re-push central topics from `/yip/dashboard/admin/topics` → **Push central topics to all chapter events** button.
- This re-attaches all 20 to every chapter event for the year.

---

## Critical phone numbers

> **Fill these in before Day 1 — write them in pen.**

- **Yi National tech contact:** ___________________________
- **Yi National YIP Co-Chair (Swapnil Ansarwadekar):** ___________________________
- **Yi National YIP Chair (Pradeep Chenthilkumar):** ___________________________
- **Your chapter EM (backup contact):** ___________________________
- **Venue IT / wifi support:** ___________________________

---

## What you CANNOT do (don't try)

- Delete a participant, party, or event (super-admin only)
- Edit the rubric (set centrally per year)
- Change another chapter's data (login is scoped)
- Override a single student's position bonus (computed from role)

For any of these, **contact the Yi National tech contact** — do not work around it.

---

*Version 1.0 — 2026-05-28*
