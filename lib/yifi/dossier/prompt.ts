/**
 * YiFi Dossier Engine — prompt builder.
 *
 * Plain module (NOT "use server"). Turns a registrant's census vector + the
 * edition's sessions into the system + user prompts for Claude. The engine
 * (generate.ts) calls these and parses the strict-JSON response.
 */

import {
  DOSSIER_MODEL,
  TRANSCRIPT_EXCERPT_CHARS,
  MAX_SESSIONS_IN_PROMPT,
  ACTION_PLAN_ITEMS,
  type DossierRegistrantInput,
  type DossierSessionInput,
} from "./types";

// Re-export the model so the engine imports a single source.
export { DOSSIER_MODEL };

/**
 * The system prompt: defines the persona, the task, and the STRICT JSON shape
 * Claude must return. We ask for raw JSON only (no prose, no markdown fences),
 * but the engine still strips fences defensively.
 */
export const DOSSIER_SYSTEM_PROMPT = `You are the personalisation engine for YiFi, a Young Indians business summit. After the summit, every attendee receives a personalised dossier: ~11 hours of stage content distilled down to ONLY what is relevant to THEIR sector and THEIR stated business challenges.

Your job: read the attendee's profile (sector, challenges, what they can offer) and the list of summit sessions (title, speaker, themes, and a transcript excerpt), then produce a tightly personalised dossier.

Rules:
- Relevance over coverage. Prefer the few sessions that actually speak to this attendee's sector and challenges. Do NOT summarise every session.
- Ground every quote and takeaway in the supplied session material. Never invent a speaker, a session, or a quote that is not supported by the input.
- The action_plan must contain exactly ${ACTION_PLAN_ITEMS} concrete, dated items the attendee can act on, ordered by day_offset (days after the summit), each tied to something from the content.
- Write in plain, direct business English. No filler, no marketing words.

Respond with ONLY valid JSON (no commentary, no markdown code fences) matching EXACTLY this structure:
{
  "top_quotes": [
    { "quote": "<verbatim or close paraphrase from a session>", "speaker": "<speaker name>", "session_title": "<session title>", "why_relevant": "<one sentence: why this matters for THIS attendee>" }
  ],
  "takeaways": [
    { "session_title": "<session title>", "takeaway": "<one actionable insight for this attendee>" }
  ],
  "speaker_ranking": [
    { "speaker": "<speaker name>", "reason": "<why this attendee should prioritise following up with this speaker>" }
  ],
  "action_plan": [
    { "day_offset": <integer days after summit>, "action": "<specific action>" }
  ],
  "tour_cards": []
}`;

/** Trim a transcript to a token-sane excerpt, noting when we fell back to a URL. */
function transcriptExcerpt(session: DossierSessionInput): string {
  const text = (session.transcript_text ?? "").trim();
  if (text.length > 0) {
    if (text.length <= TRANSCRIPT_EXCERPT_CHARS) return text;
    return text.slice(0, TRANSCRIPT_EXCERPT_CHARS) + " …[excerpt truncated]";
  }
  if (session.transcript_url) {
    return "[no transcript text available — source recording: " + session.transcript_url + "]";
  }
  return "[no transcript available for this session]";
}

function formatList(values: string[] | null | undefined): string {
  if (!values || values.length === 0) return "None recorded";
  return values.join(", ");
}

function formatCanOffer(value: DossierRegistrantInput["can_offer"]): string {
  if (value == null) return "None recorded";
  try {
    const json = JSON.stringify(value);
    if (json === "{}" || json === "[]" || json === "null") return "None recorded";
    return json;
  } catch {
    return "None recorded";
  }
}

/**
 * Build the user prompt for a single registrant against the edition's sessions.
 * Caps the number of sessions and the transcript length to keep tokens sane.
 */
export function buildDossierUserPrompt(
  registrant: DossierRegistrantInput,
  sessions: DossierSessionInput[]
): string {
  const profile = [
    `Name: ${registrant.full_name ?? "Unknown"}`,
    `Sector: ${registrant.sector ?? "Unspecified"}`,
    `Organisation: ${registrant.organisation ?? "Unspecified"}`,
    `Designation: ${registrant.designation ?? "Unspecified"}`,
    `City: ${registrant.city ?? "Unspecified"}`,
    `Business challenges: ${formatList(registrant.challenges)}`,
    `What they can offer others: ${formatCanOffer(registrant.can_offer)}`,
  ].join("\n");

  const capped = sessions.slice(0, MAX_SESSIONS_IN_PROMPT);

  const sessionBlocks = capped
    .map((s, i) => {
      return [
        `### Session ${i + 1}: ${s.title ?? "Untitled"}`,
        `Speaker: ${s.speaker_name ?? "Unknown"}`,
        `Type: ${s.session_type ?? "Unspecified"}`,
        `Themes: ${formatList(s.themes)}`,
        `Transcript excerpt: ${transcriptExcerpt(s)}`,
      ].join("\n");
    })
    .join("\n\n");

  return `Build a personalised YiFi dossier for this attendee.

## ATTENDEE PROFILE
${profile}

## SUMMIT SESSIONS (${capped.length} of ${sessions.length})
${sessionBlocks || "No session content available."}

Now produce the dossier as strict JSON per the system instructions. Filter to this attendee's sector and challenges; do not include sessions that are irrelevant to them.`;
}
