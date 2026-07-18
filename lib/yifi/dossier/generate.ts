/**
 * YiFi Dossier Engine — generation.
 *
 * Plain module (NOT "use server"). The engine: reads a registrant's census
 * vector + the edition's sessions, calls Claude to filter/rank/summarise,
 * parses the JSON, and upserts the dossier row with status 'ready'.
 *
 * Anthropic SDK usage mirrors lib/ai-assessment.ts (the canonical pattern).
 * Degrades gracefully when ANTHROPIC_API_KEY is absent — never throws/crashes.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/yifi/supabase/server";
import {
  DOSSIER_MODEL,
  GENERATE_CONCURRENCY,
  type DossierContent,
  type DossierRegistrantInput,
  type DossierSessionInput,
  type GenerateOneResult,
  type GenerateAllResult,
} from "./types";
import { DOSSIER_SYSTEM_PROMPT, buildDossierUserPrompt } from "./prompt";

// ── Anthropic client (mirrors lib/ai-assessment.ts) ─────────────────────────
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/** Strip markdown code fences and surrounding noise, then JSON.parse. */
function parseDossierJson(text: string): DossierContent {
  let cleaned = text.trim();

  // Strip ```json ... ``` or ``` ... ``` fences if present.
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // If there's still prose around it, grab the outermost JSON object.
  if (!cleaned.startsWith("{")) {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      cleaned = cleaned.slice(first, last + 1);
    }
  }

  const parsed = JSON.parse(cleaned) as Partial<DossierContent>;

  // Normalise to the full shape so callers always get arrays.
  return {
    top_quotes: Array.isArray(parsed.top_quotes) ? parsed.top_quotes : [],
    takeaways: Array.isArray(parsed.takeaways) ? parsed.takeaways : [],
    speaker_ranking: Array.isArray(parsed.speaker_ranking) ? parsed.speaker_ranking : [],
    action_plan: Array.isArray(parsed.action_plan) ? parsed.action_plan : [],
    tour_cards: Array.isArray(parsed.tour_cards) ? parsed.tour_cards : [],
  };
}

/**
 * Generate (or regenerate) the dossier for one registrant.
 *
 * Builds the prompt, calls Claude, parses the JSON, and upserts the dossier
 * with status 'ready'. Returns { ok:false, error } on any failure — never
 * throws, so generateAllDossiers can keep going.
 */
export async function generateDossier(
  editionId: string,
  registrant: DossierRegistrantInput,
  sessions: DossierSessionInput[]
): Promise<GenerateOneResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "ANTHROPIC_API_KEY not configured" };
  }

  let content: DossierContent;
  try {
    const userPrompt = buildDossierUserPrompt(registrant, sessions);

    const response = await anthropic.messages.create({
      model: DOSSIER_MODEL,
      max_tokens: 4000,
      system: DOSSIER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "No text response from Claude" };
    }

    content = parseDossierJson(textBlock.text);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown Claude error";
    return { ok: false, error: msg };
  }

  // Persist via the upsert RPC.
  try {
    const svc = await createServiceClient();
    const { error } = await svc.rpc("yifi_admin_upsert_dossier", {
      p_edition_id: editionId,
      p_registrant_id: registrant.id,
      p_top_quotes: content.top_quotes,
      p_takeaways: content.takeaways,
      p_speaker_ranking: content.speaker_ranking,
      p_action_plan: content.action_plan,
      p_tour_cards: content.tour_cards,
      p_status: "ready",
    });

    if (error) {
      return { ok: false, error: error.message };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to write dossier";
    return { ok: false, error: msg };
  }

  return { ok: true };
}

/**
 * Generate dossiers for every census-complete registrant in the edition.
 *
 * Reads registrants + sessions via the engine's own RPCs, then processes them
 * in small concurrent batches (<= GENERATE_CONCURRENCY) to respect Anthropic
 * rate limits. Collects per-registrant errors without aborting the run.
 */
export async function generateAllDossiers(
  editionId: string
): Promise<GenerateAllResult> {
  const empty: GenerateAllResult = { total: 0, succeeded: 0, failed: 0, errors: [] };

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ...empty, errors: ["ANTHROPIC_API_KEY not configured"] };
  }

  const svc = await createServiceClient();

  const { data: registrantData, error: rErr } = await svc.rpc(
    "yifi_get_registrants_for_dossier",
    { p_edition_id: editionId }
  );
  if (rErr) {
    return { ...empty, errors: [`Failed to load registrants: ${rErr.message}`] };
  }

  const { data: sessionData, error: sErr } = await svc.rpc(
    "yifi_get_edition_sessions",
    { p_edition_id: editionId }
  );
  if (sErr) {
    return { ...empty, errors: [`Failed to load sessions: ${sErr.message}`] };
  }

  const allRegistrants: DossierRegistrantInput[] = Array.isArray(registrantData)
    ? (registrantData as DossierRegistrantInput[])
    : [];
  const sessions: DossierSessionInput[] = Array.isArray(sessionData)
    ? (sessionData as DossierSessionInput[])
    : [];

  // Only census-complete registrants get a dossier.
  const registrants = allRegistrants.filter((r) => r.census_complete === true);

  const result: GenerateAllResult = {
    total: registrants.length,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  if (registrants.length === 0) {
    return result;
  }

  if (sessions.length === 0) {
    result.failed = registrants.length;
    result.errors.push("No sessions found for this edition — nothing to summarise.");
    return result;
  }

  // Process in small sequential batches (<= GENERATE_CONCURRENCY concurrent).
  for (let i = 0; i < registrants.length; i += GENERATE_CONCURRENCY) {
    const batch = registrants.slice(i, i + GENERATE_CONCURRENCY);
    const outcomes = await Promise.all(
      batch.map((registrant) => generateDossier(editionId, registrant, sessions))
    );

    outcomes.forEach((outcome, idx) => {
      if (outcome.ok) {
        result.succeeded += 1;
      } else {
        result.failed += 1;
        const who = batch[idx].full_name || batch[idx].id;
        result.errors.push(`${who}: ${outcome.error ?? "unknown error"}`);
      }
    });
  }

  return result;
}
