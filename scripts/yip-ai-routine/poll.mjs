#!/usr/bin/env node
/**
 * YIP AI routine — reference poller (TRANSPORT ONLY, no LLM).
 *
 * The prod Yi Connect app never calls an LLM. Real generation happens in an
 * hourly claude.ai routine (see docs/yip-ai-routine.md). THIS script exists so a
 * human can smoke-test the full round-trip — GET pending requests, build a
 * deterministic placeholder draft from the grounding, POST it back — without
 * wiring a model. The real routine replaces `draftFromGrounding()` below with
 * model-authored text per the prompt in docs/yip-ai-routine.md §1.
 *
 * The placeholder drafter obeys the SAME hard rules as the prompt: it narrates
 * ONLY facts present in the grounding payload and emits ZERO scores / rank /
 * comparison for participant_story AND session_feedback. So a stray test run can
 * never publish a disputable card. The session_feedback drafter is the strictest:
 * it names criteria by their grounding LABEL only and is SELF-REFERENTIAL (the
 * participant's own stronger vs weaker criterion) — never comparative to another
 * participant — and never prints a number.
 *
 * Usage:
 *   YIP_AI_ROUTINE_SECRET=… node scripts/yip-ai-routine/poll.mjs \
 *     --base https://yi-connect-app.vercel.app --once [--dry-run]
 *
 * Flags:
 *   --base <url>   App origin (default: https://yi-connect-app.vercel.app)
 *   --once         Drain the queue a single time and exit (default).
 *   --dry-run      GET + print the draft it WOULD post; do not POST.
 *
 * Env:
 *   YIP_AI_ROUTINE_SECRET   the X-Cron-Secret shared with the app (required)
 *
 * No dependencies — uses Node 18+ global fetch.
 */

const args = process.argv.slice(2);
function flag(name) {
  return args.includes(name);
}
function opt(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const BASE = opt("--base", "https://yi-connect-app.vercel.app").replace(/\/$/, "");
const DRY_RUN = flag("--dry-run");
const SECRET = process.env.YIP_AI_ROUTINE_SECRET;
const ENDPOINT = `${BASE}/yip/api/ai-drafts`;

if (!SECRET) {
  console.error(
    "ERROR: YIP_AI_ROUTINE_SECRET is not set. Export it (same value as the Vercel env)."
  );
  process.exit(2);
}

const HEADERS = { "X-Cron-Secret": SECRET };

// ─── Placeholder, score-free, fact-only drafters ────────────────────────────
// REAL ROUTINE: delete these and let the model write draftText per the prompt.

function firstName(full) {
  if (!full) return "there";
  return String(full).trim().split(/\s+/)[0] || "there";
}

function draftParticipantStory(g) {
  const p = g.participant ?? {};
  const ev = g.event ?? {};
  const lines = [];
  const where = [ev.name, ev.chapterName].filter(Boolean).join(", ");
  lines.push(
    `${firstName(p.fullName)}, here is a recap of your day in the House${
      where ? ` at ${where}` : ""
    }.`
  );
  const roleBits = [];
  if (p.roleLabel) roleBits.push(`you served as ${p.roleLabel}`);
  if (p.partyName) {
    const side = p.partySide ? ` (${p.partySide})` : "";
    roleBits.push(`representing ${p.partyName}${side}`);
  }
  if (p.constituencyName) roleBits.push(`for ${p.constituencyName}`);
  if (roleBits.length) lines.push(`${cap(roleBits.join(", "))}.`);
  if (p.committeeName) {
    const m = g.ministry ?? {};
    let s = `Your committee, ${p.committeeName}`;
    if (m.topic) s += `, worked on ${m.topic}`;
    if (m.scheme) s += ` (linked to the ${m.scheme})`;
    lines.push(`${s}.`);
  }
  const nat = (g.nationalTopics ?? []).map((t) => t.title).filter(Boolean);
  if (nat.length) lines.push(`The House took up the national topic: ${nat.join("; ")}.`);
  lines.push(
    "Thank you for taking part and for the preparation you brought to the floor."
  );
  lines.push(whatsNext(p.roleSlug));
  return lines.join(" ");
}

function whatsNext(slug) {
  const leadership = new Set([
    "prime_minister",
    "speaker",
    "deputy_speaker",
    "leader_of_opposition",
    "minister",
    "cabinet",
    "committee_chair",
    "coalition_leader",
  ]);
  if (slug && leadership.has(slug)) {
    return "What's next: chair a discussion at school, mentor a first-time delegate, and read deeper on the scheme your committee studied.";
  }
  return "What's next: keep speaking up, follow the scheme you worked on in the news, and bring a friend to the next session.";
}

function draftRoundNarrative(g) {
  const ev = g.event ?? {};
  const paras = [];
  const place = [ev.city, ev.state].filter(Boolean).join(", ");
  const days = [ev.day1Date, ev.day2Date].filter(Boolean).join(" to ");
  let p1 = `${ev.name ?? "The event"}`;
  if (ev.chapterName) p1 += ` (${ev.chapterName})`;
  if (ev.level) p1 += ` was held at the ${ev.level} level`;
  if (place) p1 += ` in ${place}`;
  if (days) p1 += ` on ${days}`;
  p1 += ".";
  const scale = [];
  if (g.participantCount) scale.push(`${g.participantCount} participants`);
  if (g.partyCount) scale.push(`${g.partyCount} parties`);
  if (scale.length) p1 += ` It convened ${scale.join(" across ")}.`;
  paras.push(p1);

  const nat = (g.nationalTopics ?? []).map((t) => t.title).filter(Boolean);
  if (nat.length) {
    paras.push(`The House debated the national topic(s): ${nat.join("; ")}.`);
  }

  const committees = (g.committees ?? []).filter((c) => c && c.name);
  if (committees.length) {
    const items = committees
      .map((c) => {
        let s = c.name;
        if (c.topic) s += ` — ${c.topic}`;
        if (c.scheme) s += ` (${c.scheme})`;
        return s;
      })
      .join("; ");
    paras.push(`Committees that sat: ${items}.`);
  }

  if (g.zeroHourSummary) {
    paras.push(g.zeroHourSummary);
  } else {
    paras.push("The session concluded as scheduled.");
  }
  return paras.join("\n\n");
}

/**
 * kind = "session_feedback" — the per-session growth note (the self-improving
 * coaching loop). The STRICTEST drafter:
 *
 *   • ZERO numbers — no score, no average, no rank, no percentage, no
 *     count-of-judges. The grounding carries routine-only ratios; we read ONLY
 *     `strength.label` / `growthFocus.label`, never any ratio/max number.
 *   • SELF-REFERENTIAL, never comparative. We acknowledge the participant's OWN
 *     relatively-stronger criterion and nudge their OWN relatively-weaker one.
 *     We NEVER say top / best / better-than / ranked / most / least-among, and
 *     we never reference another participant (the payload contains none).
 *   • Continuity: if a prior note exists, we open with a soft callback so the
 *     loop reads as a journey.
 *   • Grounded only: criterion language comes from grounding labels via a plain-
 *     language map; everything else (name, role, session title) is echoed.
 *
 * REAL ROUTINE: the model writes this in 2–3 warm sentences per the §1 prompt;
 * this placeholder just proves the transport with a true, number-free draft.
 */
function draftSessionFeedback(g) {
  const p = g.participant ?? {};
  const session = g.session ?? {};
  const name = firstName(p.fullName);
  const lines = [];

  // 1. Continuity callback to their OWN prior note, if any (the loop).
  const priors = (g.priorNotes ?? []).filter((n) => n && n.sessionTitle);
  if (priors.length) {
    const last = priors[priors.length - 1];
    lines.push(
      `${name}, building on your last session (${last.sessionTitle}), here is a note on ${
        session.title ?? "this session"
      }.`
    );
  } else {
    lines.push(
      `${name}, here is a growth note on ${session.title ?? "this session"}.`
    );
  }

  // 2. Acknowledge the participant's OWN relatively-stronger criterion (label
  //    only — never a number, never "best/top/better than anyone").
  if (g.strength && g.strength.label) {
    const what = coachPhrase(g.strength.key, g.strength.label);
    lines.push(
      `Your ${g.strength.label.toLowerCase()} came through clearly${
        roleTie(p.roleLabel) ? ` ${roleTie(p.roleLabel)}` : ""
      } — ${what.strength}`
    );
  }

  // 3. ONE concrete, encouraging focus for the NEXT session from their OWN
  //    relatively-weaker criterion. If only one criterion exists strength ===
  //    growthFocus; fall back to a generic forward nudge rather than repeating.
  if (
    g.growthFocus &&
    g.growthFocus.label &&
    (!g.strength || g.growthFocus.key !== g.strength.key)
  ) {
    const what = coachPhrase(g.growthFocus.key, g.growthFocus.label);
    lines.push(
      `For next time, give a little extra attention to your ${g.growthFocus.label.toLowerCase()}: ${what.focus}`
    );
  } else {
    lines.push(
      "For next time, keep that momentum and stretch yourself a little further on the floor — one new contribution you have not tried yet."
    );
  }

  return lines.join(" ");
}

/**
 * Plain-language coaching phrases keyed off the criterion. The grounding LABEL
 * is always spoken verbatim by the caller; this map only supplies the warm
 * "what to keep doing / what to try next" clause. Keys are matched loosely
 * (substring on the namespaced criterion key, e.g. "mupi.communication",
 * "cmte.initiative", "qh.procedure") so new rubrics degrade to the generic line
 * rather than inventing anything. NO numbers, NO comparison appear here.
 */
function coachPhrase(key, _label) {
  const k = String(key || "").toLowerCase();
  const has = (s) => k.includes(s);
  // vision / strategy / policy orientation
  if (has("vision") || has("strategy") || has("policy") || has("originality")) {
    return {
      strength: "you kept the bigger picture in view while you spoke.",
      focus:
        "before the next session, jot one clear goal you want the House to take away, and steer back to it.",
    };
  }
  // procedure / conduct / rules of the House
  if (has("procedure") || has("conduct") || has("parliamentary")) {
    return {
      strength: "you carried yourself with poise and respected the House.",
      focus:
        "read one more page of the procedure guide so the rules of the House feel second nature.",
    };
  }
  // initiative / floor presence / participation
  if (
    has("initiative") ||
    has("floor_presence") ||
    has("influence") ||
    has("negotiation") ||
    has("coalition")
  ) {
    return {
      strength: "you stepped forward and made your presence felt.",
      focus:
        "aim to be among the first to raise your hand once next session, even on a smaller point.",
    };
  }
  // communication / clarity / response / supplementaries
  if (
    has("communication") ||
    has("response") ||
    has("supplementar") ||
    has("rebuttal") ||
    has("argument")
  ) {
    return {
      strength: "you made your case clearly for the House to follow.",
      focus:
        "practise a short, tight version of your main argument so it stays crisp under pressure.",
    };
  }
  // research / subject knowledge / drafting / preparation
  if (
    has("research") ||
    has("knowledge") ||
    has("drafting") ||
    has("understanding") ||
    has("quality") ||
    has("relevance") ||
    has("subject")
  ) {
    return {
      strength: "the preparation you brought showed in your contributions.",
      focus:
        "pick one fact or example about your topic to have ready before the next session.",
    };
  }
  // teamwork / collaboration / problem solving / creativity
  if (
    has("team") ||
    has("collaboration") ||
    has("problem") ||
    has("creativity") ||
    has("critical") ||
    has("adaptab") ||
    has("support")
  ) {
    return {
      strength: "you worked well with others to move the discussion along.",
      focus:
        "try drawing one quieter member into the conversation next session — it lifts the whole bench.",
    };
  }
  // time management
  if (has("time")) {
    return {
      strength: "you used your time on the floor purposefully.",
      focus:
        "rehearse landing your point a few seconds early so you never feel rushed.",
    };
  }
  return {
    strength: "it added to the session.",
    focus:
      "pick one small, specific thing to try next session and go for it with confidence.",
  };
}

/** A short, neutral role tie-in ("as Prime Minister"). Never invents a role. */
function roleTie(roleLabel) {
  if (!roleLabel) return "";
  return `as ${roleLabel}`;
}

function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function draftFromGrounding(g) {
  if (!g || !g.kind) return null;
  if (g.kind === "participant_story") return draftParticipantStory(g);
  if (g.kind === "round_narrative") return draftRoundNarrative(g);
  if (g.kind === "session_feedback") return draftSessionFeedback(g);
  return null; // future kinds → skip
}

// ─── Loop ───────────────────────────────────────────────────────────────────

async function getPending() {
  const res = await fetch(ENDPOINT, { method: "GET", headers: HEADERS });
  if (res.status === 401) {
    throw new Error(
      "401 Unauthorized — YIP_AI_ROUTINE_SECRET does not match the app (or is unset in Vercel)."
    );
  }
  if (!res.ok) throw new Error(`GET failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function postDraft(id, draftText, sourceRefs) {
  const body = {
    id,
    draftText,
    sourceRefs: sourceRefs ?? [],
    modelNote: `reference-poller (placeholder, NOT model), ${new Date().toISOString()}`,
  };
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (res.status === 404) return { skipped: true, reason: "no longer pending" };
  if (!res.ok) throw new Error(`POST failed: ${res.status} ${txt}`);
  return { ok: true, body: txt };
}

async function drainOnce() {
  const { count, requests } = await getPending();
  console.log(`pending: ${count}`);
  let posted = 0;
  let skipped = 0;
  for (const r of requests ?? []) {
    if (!r.grounding) {
      console.log(`  skip ${r.id} (${r.kind}) — grounding null`);
      skipped++;
      continue;
    }
    const draftText = draftFromGrounding(r.grounding);
    if (!draftText) {
      console.log(`  skip ${r.id} (${r.kind}) — no drafter for kind`);
      skipped++;
      continue;
    }
    if (DRY_RUN) {
      console.log(`  [dry-run] would POST ${r.id} (${r.kind}):`);
      console.log(
        draftText
          .split("\n")
          .map((l) => "      " + l)
          .join("\n")
      );
      continue;
    }
    const out = await postDraft(r.id, draftText, r.grounding.sourceRefs);
    if (out.skipped) {
      console.log(`  skip ${r.id} (${r.kind}) — ${out.reason}`);
      skipped++;
    } else {
      console.log(`  posted ${r.id} (${r.kind})`);
      posted++;
    }
  }
  console.log(
    DRY_RUN
      ? `dry-run complete (${(requests ?? []).length} would be considered)`
      : `done — posted ${posted}, skipped ${skipped}`
  );
}

drainOnce().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
