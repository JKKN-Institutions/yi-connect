/**
 * Event Auto-Pilot Data Layer
 *
 * Cached data fetching for auto-pilot runs + settings lookup.
 */

import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type {
  EventAutopilotRun,
  AutopilotSettings,
} from '@/types/autopilot';
import { DEFAULT_AUTOPILOT_SETTINGS } from '@/types/autopilot';

/**
 * Check if a chapter has event_autopilot feature enabled.
 * Returns false if no toggle row exists (safe default).
 */
export const isAutopilotEnabled = cache(
  async (chapterId: string): Promise<boolean> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('chapter_feature_toggles')
      .select('is_enabled')
      .eq('chapter_id', chapterId)
      .eq('feature', 'event_autopilot')
      .maybeSingle();
    if (error || !data) return false;
    return !!data.is_enabled;
  }
);

/**
 * Get the autopilot settings for a chapter (merged with defaults).
 */
export const getAutopilotSettings = cache(
  async (chapterId: string): Promise<AutopilotSettings> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('chapter_feature_toggles')
      .select('settings')
      .eq('chapter_id', chapterId)
      .eq('feature', 'event_autopilot')
      .maybeSingle();

    const stored = (data?.settings ?? {}) as Partial<AutopilotSettings>;
    return {
      ...DEFAULT_AUTOPILOT_SETTINGS,
      ...stored,
    };
  }
);

/**
 * Get the most recent autopilot run for an event.
 */
export const getLatestAutopilotRun = cache(
  async (eventId: string): Promise<EventAutopilotRun | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('event_autopilot_runs')
      .select('*')
      .eq('event_id', eventId)
      .order('triggered_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as EventAutopilotRun;
  }
);

/**
 * List autopilot runs for a chapter (most recent first).
 */
export const listChapterAutopilotRuns = cache(
  async (
    chapterId: string,
    limit = 25
  ): Promise<EventAutopilotRun[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('event_autopilot_runs')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('triggered_at', { ascending: false })
      .limit(limit);
    return (data ?? []) as EventAutopilotRun[];
  }
);
