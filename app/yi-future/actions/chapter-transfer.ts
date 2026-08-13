"use server";

// ═══════════════════════════════════════════════════════════════════════
// MOVE COLLEGES AND TEAMS BETWEEN CHAPTERS
//
// Students pick their chapter from a list when they register, and they pick
// wrong. The case this was built for: 15 Kanchipuram delegates across 12
// college records, every college physically in Ranipet / Kalavai / Vellore.
// Nothing in the app could move them — updateDelegate edits eight fields but
// not chapter_id, and updateCollege cannot change a college's chapter. The
// only remedy was editing the database by hand.
//
// FIVE PROPERTIES
//
// 1. THE COLLEGE MOVES, NOT JUST THE STUDENTS. Moving only the people leaves
//    the college filed under the old chapter, so the next student from it
//    registers into the old chapter again and the mistake regrows. Selecting a
//    college moves the college row AND its delegates in the source chapter.
//
// 2. A TEAM MOVES WHOLE. Team-based scoring assumes one chapter, so moving
//    some members and not others would split a team across two chapters.
//    Selecting a team moves the team row AND every one of its members.
//
// 3. THE RECORD IS WRITTEN FIRST. Every line goes into
//    future.chapter_transfer_log before a single row is updated, and if that
//    insert fails NOTHING moves. A transfer that cannot be recorded does not
//    happen. One batch_id ties everything moved by a single click together.
//
// 4. IT FAILS CLOSED. National admins only, and every selected entity is
//    re-read and checked to actually be in the source chapter before it is
//    touched. A stale checkbox from a page loaded ten minutes ago cannot move
//    something that has since moved elsewhere.
//
// 5. IT DENIES EXPLICITLY. Every refusal returns a sentence. No silent
//    redirect — that produces a bounce-loop nobody can diagnose.
// ═══════════════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { resolveFutureAccessOrNull } from "@/lib/yi-future/auth/require-access";
import { safeError } from "@/lib/yi-future/db-error";
import {
  TRANSFER_DELEGATE_CAP,
  TRANSFER_REASON_MAX,
  type TransferPlanLine,
} from "@/lib/yi-future/chapter-transfer";

type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

// future.chapter_transfer_log is not in the generated types (as with every
// table added after the last regen) → loose client for those statements.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

/**
 * Move the selected colleges and teams from one chapter to another.
 *
 * Called from a plain <form>, so it takes FormData: `from`, `to`, `reason`,
 * and repeated `college` / `team` values for the ticked checkboxes.
 */
export async function transferToChapter(
  formData: FormData
): Promise<ActionResult> {
  // ─── 1. Authorization. National only, fails closed ────────────────────
  const access = await resolveFutureAccessOrNull();
  if (!access) {
    return {
      ok: false,
      error: "Nothing was moved. You are not signed in as a Yi Future admin.",
    };
  }
  if (!access.isNational) {
    return {
      ok: false,
      error:
        "Nothing was moved. Only a Yi Future national admin can move a college or team between chapters.",
    };
  }

  const fromChapterId = String(formData.get("from") ?? "").trim();
  const toChapterId = String(formData.get("to") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const collegeIds = formData.getAll("college").map(String).filter(Boolean);
  const teamIds = formData.getAll("team").map(String).filter(Boolean);

  if (!fromChapterId || !toChapterId) {
    return {
      ok: false,
      error: "Nothing was moved. Choose the chapter to move from and the one to move to.",
    };
  }
  if (fromChapterId === toChapterId) {
    return {
      ok: false,
      error: "Nothing was moved. The two chapters are the same.",
    };
  }
  if (collegeIds.length === 0 && teamIds.length === 0) {
    return {
      ok: false,
      error: "Nothing was moved. Tick at least one college or team first.",
    };
  }
  if (reason.length > TRANSFER_REASON_MAX) {
    return {
      ok: false,
      error: `Nothing was moved. The reason is ${reason.length} characters; keep it under ${TRANSFER_REASON_MAX} so it fits in the record.`,
    };
  }

  const svc = await createServiceClient();
  const loose = svc as AnyClient;

  // ─── 2. Both chapters must exist ──────────────────────────────────────
  const { data: chapterRows } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name")
    .in("id", [fromChapterId, toChapterId]);

  const chapters = (chapterRows as { id: string; name: string }[] | null) ?? [];
  const fromChapter = chapters.find((c) => c.id === fromChapterId);
  const toChapter = chapters.find((c) => c.id === toChapterId);
  if (!fromChapter || !toChapter) {
    return {
      ok: false,
      error: "Nothing was moved. One of those chapters no longer exists — reload the page.",
    };
  }

  // ─── 3. Re-read every selection and confirm it is still in `from` ─────
  // The checkboxes came from a page that may be minutes old. Anything that is
  // no longer in the source chapter is refused rather than dragged along.
  const plan: TransferPlanLine[] = [];

  if (collegeIds.length > 0) {
    const { data: colRows, error: colErr } = await svc
      .schema("future")
      .from("colleges")
      .select("id, name, city, chapter_id")
      .in("id", collegeIds);
    if (colErr) {
      return { ok: false, error: safeError(colErr.message, "chapter-transfer.readColleges") };
    }
    const cols =
      (colRows as {
        id: string;
        name: string;
        city: string | null;
        chapter_id: string | null;
      }[] | null) ?? [];

    for (const id of collegeIds) {
      const col = cols.find((c) => c.id === id);
      if (!col) {
        return {
          ok: false,
          error: "Nothing was moved. One of the colleges no longer exists — reload the page.",
        };
      }
      // Fail closed: a null chapter denies rather than skipping the check.
      if (!col.chapter_id || col.chapter_id !== fromChapterId) {
        return {
          ok: false,
          error: `Nothing was moved. "${col.name}" is not in ${fromChapter.name} any more — reload the page and try again.`,
        };
      }
      const { count } = await svc
        .schema("future")
        .from("delegates")
        .select("id", { count: "exact", head: true })
        .eq("college_id", id)
        .eq("chapter_id", fromChapterId);

      // Does the destination already have this college? If so this is a merge,
      // not a move — the database would refuse the move outright.
      const target = await resolveMergeTarget(
        svc,
        toChapterId,
        col.name,
        col.city
      );
      if (target && target.id === id) {
        return {
          ok: false,
          error: `Nothing was moved. "${col.name}" appears to already be its own merge target — reload the page.`,
        };
      }

      plan.push({
        entityType: "college",
        entityId: id,
        entityName: col.name,
        delegatesMoved: count ?? 0,
        mergeTargetId: target?.id ?? null,
        mergeTargetName: target?.name ?? null,
      });
    }
  }

  if (teamIds.length > 0) {
    const { data: teamRows, error: teamErr } = await svc
      .schema("future")
      .from("teams")
      .select("id, team_name, chapter_id")
      .in("id", teamIds);
    if (teamErr) {
      return { ok: false, error: safeError(teamErr.message, "chapter-transfer.readTeams") };
    }
    const tms = (teamRows as { id: string; team_name: string; chapter_id: string | null }[] | null) ?? [];

    for (const id of teamIds) {
      const t = tms.find((x) => x.id === id);
      if (!t) {
        return {
          ok: false,
          error: "Nothing was moved. One of the teams no longer exists — reload the page.",
        };
      }
      if (!t.chapter_id || t.chapter_id !== fromChapterId) {
        return {
          ok: false,
          error: `Nothing was moved. Team "${t.team_name}" is not in ${fromChapter.name} any more — reload the page and try again.`,
        };
      }
      const { count } = await svc
        .schema("future")
        .from("team_members")
        .select("delegate_id", { count: "exact", head: true })
        .eq("team_id", id);
      plan.push({
        entityType: "team",
        entityId: id,
        entityName: t.team_name,
        delegatesMoved: count ?? 0,
      });
    }
  }

  // A college and a team can both carry the same student, so this total is an
  // upper bound rather than a headcount. That is the right side to be wrong on
  // for a safety cap.
  const totalDelegates = plan.reduce((n, l) => n + l.delegatesMoved, 0);
  if (totalDelegates > TRANSFER_DELEGATE_CAP) {
    return {
      ok: false,
      error: `Nothing was moved. That selection carries about ${totalDelegates} students, over the ${TRANSFER_DELEGATE_CAP} limit for one move. Move it in smaller batches so each one stays reviewable.`,
    };
  }

  // ─── 4. THE RECORD, BEFORE ANYTHING MOVES ─────────────────────────────
  const batchId = crypto.randomUUID();
  const actor = await describeActor(access.userId);

  const { error: logErr } = await loose
    .schema("future")
    .from("chapter_transfer_log")
    .insert(
      plan.map((line) => ({
        transferred_by: actor ?? access.userId,
        entity_type: line.entityType,
        entity_id: line.entityId,
        entity_name: line.entityName,
        from_chapter_id: fromChapterId,
        to_chapter_id: toChapterId,
        from_chapter_name: fromChapter.name,
        to_chapter_name: toChapter.name,
        delegates_moved: line.delegatesMoved,
        // The record must say which of the two things happened. "Moved" and
        // "merged into an existing record" have different consequences and an
        // award dispute a year later needs to tell them apart.
        reason: [
          line.mergeTargetName
            ? `MERGED into existing ${toChapter.name} record "${line.mergeTargetName}".`
            : null,
          reason.length > 0 ? reason : null,
        ]
          .filter(Boolean)
          .join(" ") || null,
        batch_id: batchId,
      }))
    );

  if (logErr) {
    return {
      ok: false,
      error: `Nothing was moved. The transfer record could not be written, and a move that cannot be recorded must not happen. (${safeError(
        logErr.message,
        "chapter-transfer.writeLog"
      )})`,
    };
  }

  // ─── 5. Apply. Teams first, then colleges ─────────────────────────────
  // A student can be both on a moved team and at a moved college; both set the
  // same target chapter, so the order only affects which statement touches the
  // row first, never the result.
  const failures: string[] = [];

  for (const line of plan.filter((l) => l.entityType === "team")) {
    const { data: memberRows } = await svc
      .schema("future")
      .from("team_members")
      .select("delegate_id")
      .eq("team_id", line.entityId);
    const memberIds = ((memberRows as { delegate_id: string }[] | null) ?? []).map(
      (m) => m.delegate_id
    );

    const { error: tErr } = await svc
      .schema("future")
      .from("teams")
      .update({ chapter_id: toChapterId })
      .eq("id", line.entityId)
      .eq("chapter_id", fromChapterId);
    if (tErr) {
      failures.push(`team "${line.entityName}": ${safeError(tErr.message, "chapter-transfer.moveTeam")}`);
      continue;
    }

    if (memberIds.length > 0) {
      const { error: mErr } = await svc
        .schema("future")
        .from("delegates")
        .update({ chapter_id: toChapterId })
        .in("id", memberIds);
      if (mErr) {
        failures.push(
          `members of "${line.entityName}": ${safeError(mErr.message, "chapter-transfer.moveTeamMembers")}`
        );
      }
    }
  }

  for (const line of plan.filter((l) => l.entityType === "college")) {
    if (line.mergeTargetId) {
      // MERGE. The destination already has this college, so moving the row is
      // impossible (unique on chapter+name+city) and also wrong — there would
      // then be two records for one institution. Repoint the students, then
      // soft-merge the source. This is exactly what mergePendingCollege does;
      // the source row keeps its chapter, which is why no constraint fires.
      const { error: relinkErr } = await svc
        .schema("future")
        .from("delegates")
        .update({ college_id: line.mergeTargetId, chapter_id: toChapterId })
        .eq("college_id", line.entityId);
      if (relinkErr) {
        failures.push(
          `students at "${line.entityName}": ${safeError(relinkErr.message, "chapter-transfer.relinkOnMerge")}`
        );
        continue;
      }

      // Only after every student is repointed — otherwise a failure here would
      // strand them on a college marked merged-away.
      const { error: mergeErr } = await svc
        .schema("future")
        .from("colleges")
        .update({ merged_into: line.mergeTargetId, is_approved: false })
        .eq("id", line.entityId);
      if (mergeErr) {
        failures.push(
          `merging "${line.entityName}": ${safeError(mergeErr.message, "chapter-transfer.softMerge")}`
        );
      }
      continue;
    }

    const { error: cErr } = await svc
      .schema("future")
      .from("colleges")
      .update({ chapter_id: toChapterId })
      .eq("id", line.entityId)
      .eq("chapter_id", fromChapterId);
    if (cErr) {
      failures.push(
        `college "${line.entityName}": ${safeError(cErr.message, "chapter-transfer.moveCollege")}`
      );
      continue;
    }

    const { error: dErr } = await svc
      .schema("future")
      .from("delegates")
      .update({ chapter_id: toChapterId })
      .eq("college_id", line.entityId)
      .eq("chapter_id", fromChapterId);
    if (dErr) {
      failures.push(
        `students at "${line.entityName}": ${safeError(dErr.message, "chapter-transfer.moveCollegeDelegates")}`
      );
    }
  }

  revalidatePath("/yi-future/national/admin/chapter-transfer");
  revalidatePath("/yi-future/chapter/delegates");
  revalidatePath("/yi-future/chapter/colleges");
  revalidatePath("/yi-future/chapter/teams");

  if (failures.length > 0) {
    // Partial failure is reported in full rather than rounded to "something
    // went wrong": the log already records what was intended, so naming what
    // did not land is what makes the difference fixable.
    return {
      ok: false,
      error: `Partly moved. These did not: ${failures.join("; ")}. The transfer record was written, so compare it against the chapter before retrying.`,
    };
  }

  const colleges = plan.filter((l) => l.entityType === "college").length;
  const teams = plan.filter((l) => l.entityType === "team").length;
  const parts = [
    colleges > 0 ? `${colleges} college${colleges === 1 ? "" : "s"}` : null,
    teams > 0 ? `${teams} team${teams === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return {
    ok: true,
    message: `Moved ${parts.join(" and ")} from ${fromChapter.name} to ${toChapter.name}, carrying about ${totalDelegates} student${totalDelegates === 1 ? "" : "s"}.`,
  };
}

/**
 * The college in `chapterId` that `name`/`city` collides with, resolved to the
 * row that actually SURVIVES.
 *
 * Two things make this necessary:
 *   • `uq_colleges_chapter_name_city` is unique on
 *     (chapter_id, lower(name), coalesce(lower(city),'')), so a move into a
 *     chapter that already has the same college is rejected outright.
 *   • That constraint does NOT ignore `merged_into`. A twin that was itself
 *     soft-merged still occupies the key, so pairing only against un-merged
 *     rows finds nothing and the move fails anyway. Both were observed on the
 *     first real use of this screen.
 *
 * So: match any row, merged or not, then walk `merged_into` to the survivor —
 * which is where the students should actually land.
 */
async function resolveMergeTarget(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  chapterId: string,
  name: string,
  city: string | null
): Promise<{ id: string; name: string } | null> {
  const { data } = await svc
    .schema("future")
    .from("colleges")
    .select("id, name, city, merged_into")
    .eq("chapter_id", chapterId);

  const rows =
    (data as {
      id: string;
      name: string;
      city: string | null;
      merged_into: string | null;
    }[] | null) ?? [];

  const key = (n: string, c: string | null) =>
    `${n.trim().toLowerCase()}|${(c ?? "").trim().toLowerCase()}`;
  const byId = new Map(rows.map((r) => [r.id, r]));

  let cur = rows.find((r) => key(r.name, r.city) === key(name, city)) ?? null;
  if (!cur) return null;

  // Follow the merge chain to the surviving record. Bounded so a cycle in the
  // data cannot hang the request.
  for (let hop = 0; hop < 5 && cur.merged_into; hop++) {
    const next = byId.get(cur.merged_into);
    if (!next) break;
    cur = next;
  }
  return { id: cur.id, name: cur.name };
}

/** Name or email of the acting admin, for the record. Never throws. */
async function describeActor(userId: string): Promise<string | null> {
  try {
    const svc = await createServiceClient();
    // yi_directory is the canonical identity spine and is not in the generated
    // future types → loose client, the established cross-schema pattern.
    const { data } = await (svc as AnyClient)
      .schema("yi_directory")
      .from("people")
      .select("full_name, email")
      .eq("user_id", userId)
      .maybeSingle();
    const row = data as { full_name: string | null; email: string | null } | null;
    return row?.full_name ?? row?.email ?? null;
  } catch {
    return null;
  }
}
