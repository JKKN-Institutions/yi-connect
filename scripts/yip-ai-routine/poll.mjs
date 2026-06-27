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
 * comparison for participant_story. So a stray test run can never publish a
 * disputable card.
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

function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function draftFromGrounding(g) {
  if (!g || !g.kind) return null;
  if (g.kind === "participant_story") return draftParticipantStory(g);
  if (g.kind === "round_narrative") return draftRoundNarrative(g);
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
