/**
 * Minimal Gamification Points Helper
 *
 * Insert a row into member_points_log. Idempotent via UNIQUE constraint on
 * (member_id, action_type, source_id). Subsequent inserts for the same key
 * are silently dropped (no error thrown).
 *
 * This is a minimal slice of the full cluster-4 gamification plan — enough
 * to rank members by engagement delta for the quarterly report. Badge/
 * leaderboard UI is deferred.
 */

import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface AwardPointsInput {
  member_id: string;
  chapter_id: string;
  points: number;
  reason: string;
  action_type: string;
  source_id?: string | null;
  source_type?: string | null;
}

export interface AwardPointsResult {
  success: boolean;
  points_log_id?: string;
  duplicate?: boolean;
  error?: string;
}

/**
 * Award points to a single member. Returns { duplicate: true } if a matching
 * (member_id, action_type, source_id) row already exists.
 */
export async function awardPoints(
  input: AwardPointsInput
): Promise<AwardPointsResult> {
  if (input.points === 0) {
    return { success: false, error: 'Points must be non-zero' };
  }

  const supabase = await createClient();

  const payload = {
    member_id: input.member_id,
    chapter_id: input.chapter_id,
    points: input.points,
    reason: input.reason,
    action_type: input.action_type,
    source_id: input.source_id ?? null,
    source_type: input.source_type ?? null,
  };

  const { data, error } = await supabase
    .from('member_points_log')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    // Unique-violation = already awarded — silently treat as success
    const code = (error as { code?: string }).code;
    if (code === '23505') {
      return { success: true, duplicate: true };
    }
    console.error('awardPoints failed:', error);
    return { success: false, error: error.message };
  }

  return { success: true, points_log_id: data.id };
}

/**
 * Bulk award points (one row per member_id). Returns counts of
 * awarded/duplicate/failed.
 */
export async function awardPointsBulk(
  members: Array<{ member_id: string; chapter_id: string }>,
  opts: {
    points: number;
    reason: string;
    action_type: string;
    source_id?: string | null;
    source_type?: string | null;
  }
): Promise<{ awarded: number; duplicates: number; failed: number }> {
  let awarded = 0;
  let duplicates = 0;
  let failed = 0;

  for (const m of members) {
    const r = await awardPoints({
      member_id: m.member_id,
      chapter_id: m.chapter_id,
      points: opts.points,
      reason: opts.reason,
      action_type: opts.action_type,
      source_id: opts.source_id ?? null,
      source_type: opts.source_type ?? null,
    });
    if (r.duplicate) duplicates++;
    else if (r.success) awarded++;
    else failed++;
  }

  return { awarded, duplicates, failed };
}
