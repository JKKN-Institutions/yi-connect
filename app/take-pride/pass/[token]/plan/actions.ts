"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { isToken } from "@/lib/take-pride/auth";
import { tpService } from "@/lib/take-pride/supabase";
import { TP_TAGS } from "@/lib/take-pride/constants";
import { PROFILE_TAG_MAX, PROFILE_TEXT_MAX, YI_VERTICALS, onList } from "@/lib/take-pride/profile";
import { enqueueJob, getOwnJob, pingLiveTrigger } from "@/lib/take-pride/ai/queue";
import {
  ABOUT_MAX,
  GOAL_MAX,
  QUESTION_MAX,
  QUESTION_MIN,
  foldInput,
  isUuid,
  type AiKind,
  type ProfileHelperOutput,
} from "@/lib/take-pride/ai/schemas";
import type { TpResult } from "@/lib/take-pride/types";

/*
 * Delegate AI requests. "Me" is ALWAYS resolved from the pass token on the
 * server; no delegate id comes from the browser. Never redirect. The app
 * only queues work; the out-of-band routine writes it (no LLM here).
 */

const BAD_LINK = "This pass link is not valid";

async function meFromToken(token: string): Promise<{ id: string } | null> {
  if (!isToken(token)) return null;
  const { data } = await tpService().from("tp_delegates").select("id").eq("token", token).maybeSingle();
  return (data as { id: string } | null) ?? null;
}

async function queue(
  token: string,
  kind: AiKind,
  input: Record<string, unknown>,
  page: string,
  oneAtATime: boolean
): Promise<TpResult<{ remaining: number }>> {
  const me = await meFromToken(token);
  if (!me) return { success: false, error: BAD_LINK };
  const r = await enqueueJob(me.id, kind, input, { oneAtATime });
  if (!r.ok) return { success: false, error: r.error };
  after(() => pingLiveTrigger());
  revalidatePath(`/take-pride/pass/${token}/${page}`);
  return { success: true, data: { remaining: r.remaining } };
}

export async function requestSummitPlan(token: string, goal: unknown): Promise<TpResult<{ remaining: number }>> {
  if (!isToken(token)) return { success: false, error: BAD_LINK };
  const g = foldInput(goal);
  if (g.length < 10) return { success: false, error: "Tell us a little more: at least a sentence about what you want." };
  if (g.length > GOAL_MAX) return { success: false, error: `Keep it under ${GOAL_MAX} characters.` };
  return queue(token, "summit_plan", { goal: g }, "plan", true);
}

export async function requestProfileHelp(token: string, about: unknown): Promise<TpResult<{ remaining: number }>> {
  if (!isToken(token)) return { success: false, error: BAD_LINK };
  const a = foldInput(about);
  if (a.length < 10) return { success: false, error: "Write a sentence or two about you and your business." };
  if (a.length > ABOUT_MAX) return { success: false, error: `Keep it under ${ABOUT_MAX} characters.` };
  return queue(token, "profile_helper", { about: a }, "plan", true);
}

export async function requestRadar(token: string): Promise<TpResult<{ remaining: number }>> {
  return queue(token, "radar", { trigger: "request" }, "radar", true);
}

export async function askTheDesk(token: string, question: unknown): Promise<TpResult<{ remaining: number }>> {
  if (!isToken(token)) return { success: false, error: BAD_LINK };
  const q = foldInput(question);
  if (q.length < QUESTION_MIN) return { success: false, error: "Type your question first." };
  if (q.length > QUESTION_MAX) return { success: false, error: `Keep your question under ${QUESTION_MAX} characters.` };
  return queue(token, "ask", { question: q }, "ask", false);
}

/**
 * Apply a ready profile-helper suggestion. The browser names only the job;
 * the values are read from the stored suggestion (owned by this pass) and
 * checked again against the lists before writing. Writes ONLY needs, offers,
 * yi_vertical and pledge. An empty suggestion for a field keeps what is there.
 */
export async function applyProfileSuggestion(token: string, jobId: unknown): Promise<TpResult> {
  const me = await meFromToken(token);
  if (!me) return { success: false, error: BAD_LINK };
  if (!isUuid(jobId)) return { success: false, error: "That suggestion was not found." };
  const job = await getOwnJob(me.id, jobId);
  if (!job || job.kind !== "profile_helper" || job.status !== "ready" || !job.output) {
    return { success: false, error: "That suggestion was not found." };
  }
  const s = job.output as ProfileHelperOutput;
  const needs = [...new Set(onList(s.needs, TP_TAGS))].slice(0, PROFILE_TAG_MAX);
  const offers = [...new Set(onList(s.offers, TP_TAGS))].slice(0, PROFILE_TAG_MAX);
  const vertical = onList(s.yi_vertical ? [s.yi_vertical] : [], YI_VERTICALS)[0] ?? null;
  const pledge = typeof s.pledge === "string" ? s.pledge.replace(/\s+/g, " ").trim() : "";

  const patch: Record<string, unknown> = {};
  if (needs.length) patch.needs = needs;
  if (offers.length) patch.offers = offers;
  if (vertical) patch.yi_vertical = vertical;
  if (pledge && pledge.length <= PROFILE_TEXT_MAX) patch.pledge = pledge;
  if (!Object.keys(patch).length) return { success: false, error: "Nothing in that suggestion can be applied." };

  const { data, error } = await tpService().from("tp_delegates").update(patch).eq("id", me.id).eq("token", token).select("id");
  if (error) return { success: false, error: "Could not save. Please try again." };
  if (!data?.length) return { success: false, error: BAD_LINK };
  revalidatePath(`/take-pride/pass/${token}`, "layout");
  return { success: true, data: null };
}
