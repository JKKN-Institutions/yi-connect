# YIP — Committee Room (tailored committee workspace) — SPEC

**Status:** Draft for sign-off. **Decisions locked (2026-06-27):** spec-first; bill edited by
**chair + lead drafter**; **committee-internal amendment voting included**.

Replaces the vanilla per-committee chat channel with a working **Committee Room**: the
committee drafts its bill, debates it per-clause, votes amendments in/out, picks presenters,
and ships it — all in one phase-aware surface.

---

## 1. How a YIP committee behaves (the lifecycle this must fit)

- A **committee = a Ministry** (e.g. "Ministry of Education") with a **topic**
  (`events.committee_topics`), members from **both benches** (`participants.committee_name`,
  ruling + opposition mixed), assigned at allocation.
- **Day 1 — "Committee Discussion (Bill Drafting)"** (`agenda_type='committee_discussion'`,
  `session_key='committee_bill_drafting'`, mode `committee`): the committee drafts a bill on its
  topic — problem → **provisions/clauses** → expected impact → implementation — and decides who
  presents.
- **Day 2 — "Bill Presentation & Voting"** (`agenda_type='bill_presentation'`,
  `session_key='bill_presentation_voting'`, mode `party`): presenters present; the opposition
  responds (`bills.opposition_response`); the House votes (`bills.votes_for/against/abstain`).
- **Scoring (do NOT break):** jurors score the committee at the **Committee Discussion** session
  and the **Bill Presentation** session; these feed the /90 academic total via the existing
  jury-session model (committee-LEVEL /60 model is retired). The Committee Room must not change
  how scoring reads agenda sessions.

## 2. What already exists (reuse, don't reinvent)

- **`yip.bills`** — keyed by `committee_name` (+ `party_side`). Columns we use: `title`,
  `problem_statement`, `objective`, `provisions` (jsonb), `expected_impact`, `implementation`,
  `lead_drafter`, `policy_researcher`, `presenter_1`, `presenter_2`, `status`,
  `opposition_response`, `votes_*`. One bill per committee.
- **`yip.chat_channels`** (`kind='committee'`, `committee_name`) + **`yip.chat_messages`**
  (`channel_id`, sender, `body`, `deleted_at`) — the existing committee chat + moderation
  (freeze, mute, report, delete) we keep and build the Room around.
- **Roles:** `parliament_role` enum has **`committee_chair`** and **`bill_committee`**. A
  participant is the chair of committee X when `parliament_role='committee_chair'` AND
  `committee_name=X`.
- **Auth:** organisers via `getYipEventAccess(eventId).canManage`; participants via the
  access-code session (`requireParticipantSession`). Chat is flag-gated (`CHAT_ENABLED`).
- **Lock/publish guards** pattern (scores_locked / results_published_at) from `agenda.ts`.

## 3. Data model changes

### 3.1 Provisions → stable clause IDs (migration)
Per-clause discussion + amendments need stable IDs (array index breaks on reorder/delete).
Change `bills.provisions` from `string[]` to `{ id: string; text: string }[]`.
- **Migration** `…_yip_bill_provisions_clause_ids`: backfill existing rows, mapping each string
  to `{ id: <uuid>, text: <string> }`. Read paths that render provisions updated to read `.text`.
- Keep it tolerant: a normaliser accepts both shapes during transition.

### 3.2 New: `yip.bill_amendments`
`id, bill_id (fk), event_id, committee_name, clause_id (nullable — null = whole-bill/new-clause),
kind ('edit'|'add'|'remove'), proposed_text (nullable for remove), proposed_by (participant id),
status ('open'|'accepted'|'rejected'|'withdrawn'), resolved_by (participant id, nullable),
created_at, resolved_at`. RLS: committee members of (event, committee) read; insert by members;
status transitions by chair/lead-drafter or organiser (service path).

### 3.3 New: `yip.bill_amendment_votes`
`amendment_id (fk), participant_id, vote ('for'|'against'), created_at`,
UNIQUE(amendment_id, participant_id). One vote per member per amendment.

### 3.4 Per-clause discussion
Add nullable **`thread_key`** to `yip.chat_messages` (e.g. `clause:<clause_id>` or
`amendment:<id>`). Null = general committee discussion. Lets one message store back both the
general feed and per-clause/amendment threads. No new table.

> Every new SECURITY-DEFINER fn / RLS: `REVOKE EXECUTE FROM PUBLIC`; verify with
> `has_function_privilege`. DDL shown first per project rule; migration names greppable.

## 4. Permissions (fail closed)

| Action | Who |
|---|---|
| View the Committee Room | members of (event, committee) + organiser canManage |
| Edit bill draft (title/problem/provisions/impact) | **committee chair OR `bills.lead_drafter`** OR organiser canManage |
| Discuss (general + per-clause) | any committee member (unless muted/frozen) |
| Propose an amendment | any committee member |
| Vote on an amendment | any committee member (one vote each) |
| Accept/reject an amendment (applies/discards into bill) | **chair OR lead drafter** OR organiser |
| Assign roles (lead drafter, researcher, presenters) | **chair** OR organiser |
| Submit bill (`drafting→submitted`) | **chair OR lead drafter** OR organiser |
| Edit after `submitted`/locked/published | blocked (organiser unlock only) |

Chair-of-this-committee check = `parliament_role='committee_chair' && committee_name === bill.committee_name`.
All gates fail closed on null scope.

## 5. UI — the Committee Room

**Participant surface:** unify today's split `/yip/me/bill` + `/yip/me/ministry` + committee chat
into one room at **`/yip/me/committee`** (resolves the caller's committee from their participant
row). **Organiser surface:** the committee channel in Chat moderation opens the same Room
(read + moderate + edit on canManage).

**Header:** committee name · topic · **phase badge** (Drafting / Presentation / Submitted /
Voted) derived from current agenda item + bill.status · deadline countdown.

**Sections (tabs or stacked):**
1. **Bill** (pinned) — title · problem · **provisions list (each clause editable inline by
   chair/lead)** · impact · implementation. Status rail. "Submit" gated by a **readiness
   checklist** (problem set, ≥N provisions, presenters chosen).
2. **Discussion** — the committee chat (existing), anchored to the bill; a clause shows a
   "discuss" affordance that filters to `thread_key='clause:<id>'`.
3. **Amendments** — list of open amendments per clause; propose → members vote for/against →
   chair/lead **Accept** (folds `proposed_text` into the clause / adds / removes) or **Reject**.
   Accepted amendments mutate `bills.provisions` and log who/when.
4. **Roles & presenters** — chair assigns lead drafter / researcher / presenter 1 & 2 from the
   committee roster (writes the existing `bills.*` columns).
5. **Day-2 mode** — when the agenda hits `bill_presentation`, the room flips to presentation prep
   (key points, the opposition's `opposition_response` shown) and bill becomes read-only.

## 6. Server actions (new file `app/yip/actions/committee-room.ts`)
- `getCommitteeRoom(eventId, committeeName?)` → bill + clauses + amendments(+vote tallies + my
  vote) + roster + roles + phase + my-permissions. (committeeName omitted for participant =
  derive from session.)
- `saveBillField` / `saveClause` / `addClause` / `removeClause` — gated (chair|lead|organiser),
  blocked when submitted/locked.
- `assignBillRole(role, participantId)` — chair|organiser.
- `proposeAmendment` / `voteAmendment` / `resolveAmendment(accept|reject)` — members propose+vote;
  chair|lead resolve (resolve applies the change atomically + logs).
- `submitCommitteeBill` — readiness-checked + lock-guarded.
- Discussion reuses existing `chat.ts` send/list with the new `thread_key`.

## 7. Scoring & integrity guardrails
- **No change** to how `results.ts` reads committee/bill sessions — the Room only writes
  `bills.*` and amendment tables; scoring still keys off jury sessions.
- One bill per (event, committee): enforce on create (upsert by `event_id, committee_name`).
- Amendment "accept" is the ONLY path that mutates provisions besides direct chair/lead edit;
  both append a change-log entry (who/when/what) for auditability.

## 8. Build phases (after sign-off)
1. **Migration**: provisions→clause-IDs + amendment tables + `chat_messages.thread_key` (+ RLS,
   grants). Show SQL first.
2. **Actions**: `committee-room.ts` (read + edit + roles + submit) with gates + lock guards.
3. **Participant Room UI** at `/yip/me/committee` (bill + discussion + roles + checklist/submit).
4. **Amendments** (propose/vote/resolve) UI + actions.
5. **Organiser view** wiring from Chat moderation + Day-2 phase mode.
6. **tsc + lint gate; CFT smoke test** (chair edits, member proposes+votes, accept folds in,
   submit) on a mock event before prod.

## 9. Open questions for sign-off
- **Chair fallback:** if a committee has **no `committee_chair`** assigned, who edits — just the
  `lead_drafter`? auto-promote the first member? organiser-only until a chair is set? (Proposed:
  lead_drafter; if neither set, organiser-only + a prompt to assign.)
- **Amendment carry rule:** simple majority of votes cast, or chair discretion regardless of
  tally? (Proposed: chair/lead decides, with the tally shown as advice.)
- **Min provisions** for the readiness checklist (Proposed: ≥3).
- **Replace or augment** the `/yip/me/bill` page — redirect it into `/yip/me/committee`, or keep
  both? (Proposed: redirect, single source.)
