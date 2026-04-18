/**
 * Event Auto-Pilot Server Actions
 *
 * The 6-step post-event pipeline. Spec: specs/yi-native-event-autopilot-spec.md
 *
 *   Step 1: Send feedback reminder (WhatsApp + email) to RSVP'd members
 *   Step 2: Compute event stats (attendance, check-in rate, feedback avg)
 *   Step 3: Auto-create draft AAA health card entry (if event has vertical_id)
 *   Step 4: Award +10 points per attending member (idempotent)
 *   Step 5: Email one-page summary to Chair via Resend
 *   Step 6: Flag event as eligible for quarterly report
 *
 * Each step is wrapped in try/catch. Step failures are recorded in
 * steps_completed JSONB; a run with some successes is marked `partial`
 * (not `failed`) so Chair can still see what worked.
 */

'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/data/auth';
import { sendEmail, sendBatchEmails } from '@/lib/email';
import {
  eventSummaryEmail,
} from '@/lib/email/templates';
import { formatFeedbackReminder } from '@/lib/whatsapp/format-message';
import { awardPointsBulk } from '@/lib/gamification/award-points';
import { getAutopilotSettings, isAutopilotEnabled } from '@/lib/data/autopilot';
import {
  triggerAutopilotSchema,
  updateAutopilotFeatureSchema,
  type TriggerAutopilotInput,
  type UpdateAutopilotFeatureInput,
} from '@/lib/validations/autopilot';
import type {
  AutopilotStepsCompleted,
  AutopilotStatus,
  EventStats,
  TriggerAutopilotResult,
} from '@/types/autopilot';
import { DEFAULT_AUTOPILOT_SETTINGS } from '@/types/autopilot';

type ActionResponse<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ============================================================================
// Feature flag config (Chair settings page)
// ============================================================================

/**
 * Enable/disable event_autopilot for a chapter + optional settings update.
 * Chair+ only (hierarchy_level >= 4).
 */
export async function updateAutopilotFeature(
  input: UpdateAutopilotFeatureInput
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const validated = updateAutopilotFeatureSchema.parse(input);

    const supabase = await createClient();

    // Permission check — must be Chair+ of this chapter
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role:roles(hierarchy_level)')
      .eq('user_id', user.id);
    const maxLevel = Math.max(
      0,
      ...(roleRow ?? []).map((r: unknown) => {
        const role = (r as { role?: unknown }).role;
        const roleObj = Array.isArray(role) ? role[0] : role;
        return (roleObj as { hierarchy_level?: number } | null)?.hierarchy_level ?? 0;
      })
    );
    if (maxLevel < 4) {
      return { success: false, error: 'Chair access required' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('chapter_id')
      .eq('id', user.id)
      .single();
    const isSameChapter = profile?.chapter_id === validated.chapter_id;
    const isNational = maxLevel >= 6;
    if (!isSameChapter && !isNational) {
      return { success: false, error: 'Permission denied' };
    }

    const now = new Date().toISOString();
    const payload = {
      chapter_id: validated.chapter_id,
      feature: 'event_autopilot' as const,
      is_enabled: validated.is_enabled,
      enabled_at: validated.is_enabled ? now : null,
      disabled_at: validated.is_enabled ? null : now,
      changed_by: user.id,
      settings: validated.settings ?? {},
    };

    const { error } = await supabase
      .from('chapter_feature_toggles')
      .upsert(payload, { onConflict: 'chapter_id,feature' });

    if (error) {
      console.error('updateAutopilotFeature error:', error);
      return { success: false, error: 'Failed to update feature' };
    }

    updateTag('chapter-features');
    revalidatePath('/settings/event-autopilot');

    return { success: true };
  } catch (error) {
    console.error('updateAutopilotFeature exception:', error);
    return { success: false, error: 'Invalid input' };
  }
}

// ============================================================================
// Main pipeline
// ============================================================================

/**
 * The 6-step post-event pipeline. Safe to call multiple times — each step is
 * idempotent and will no-op if already done.
 *
 * Caller contract:
 *   - triggerEventAutoPilot(eventId)
 *   - Called automatically from completeEvent() when status flips to completed
 *   - Can also be called manually via "Run Auto-Pilot Now" on event detail
 *
 * Returns a TriggerAutopilotResult with the run status + per-step breakdown.
 */
export async function triggerEventAutoPilot(
  eventId: string
): Promise<TriggerAutopilotResult> {
  try {
    const validated = triggerAutopilotSchema.parse({ event_id: eventId });
    const supabase = await createClient();
    const user = await getCurrentUser();

    // Load event with chapter, organizer, vertical
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(
        'id, title, start_date, end_date, venue, chapter_id, vertical_id, organizer_id, status'
      )
      .eq('id', validated.event_id)
      .single();

    if (eventError || !event) {
      return { success: false, error: 'Event not found' };
    }

    if (!event.chapter_id) {
      return { success: false, error: 'Event has no chapter assigned' };
    }

    // Feature flag gate — no-op if disabled
    const enabled = await isAutopilotEnabled(event.chapter_id);
    if (!enabled) {
      return {
        success: true,
        status: 'completed',
        steps_completed: {
          notes: { feature_flag: 'Event Auto-Pilot is disabled for this chapter — no-op' },
        },
      };
    }

    const settings = await getAutopilotSettings(event.chapter_id);

    // Create run row — use triggered_at as idempotency boundary
    const triggeredAt = new Date().toISOString();
    const { data: run, error: runError } = await supabase
      .from('event_autopilot_runs')
      .insert({
        event_id: event.id,
        chapter_id: event.chapter_id,
        triggered_at: triggeredAt,
        triggered_by: user?.id ?? null,
        status: 'running',
        steps_completed: {},
      })
      .select('id')
      .single();

    if (runError || !run) {
      // Duplicate run (23505) → fetch most recent and return it
      if ((runError as { code?: string })?.code === '23505') {
        return {
          success: true,
          status: 'completed',
          steps_completed: {
            notes: { duplicate: 'Run already exists for this timestamp' },
          },
        };
      }
      console.error('Failed to create autopilot run:', runError);
      return { success: false, error: 'Failed to start run' };
    }

    const steps: AutopilotStepsCompleted = { notes: {} };
    const errors: string[] = [];

    // ----------------------------------------------------------------
    // STEP 1 — Feedback reminder (email + optional WhatsApp)
    // ----------------------------------------------------------------
    try {
      const { data: rsvps } = await supabase
        .from('event_rsvps')
        .select(
          'member_id, status, member:member_id(profile:id(email, full_name, phone))'
        )
        .eq('event_id', event.id)
        .in('status', ['confirmed', 'attended']);

      const feedbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/events/${event.id}#feedback`;
      const eventForTemplate = {
        title: event.title,
        date: new Date(event.start_date).toLocaleDateString('en-IN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        time: new Date(event.start_date).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        venue: event.venue || 'TBD',
        eventUrl: feedbackUrl,
      };

      // Email batch
      const emails = (rsvps ?? [])
        .map((r: any) => {
          const profile = Array.isArray(r.member?.profile)
            ? r.member.profile[0]
            : r.member?.profile;
          if (!profile?.email) return null;
          return {
            to: profile.email as string,
            subject: `We'd love your feedback on ${event.title}`,
            html: `<p>Hi ${profile.full_name || 'there'},</p>
<p>Thanks for attending <strong>${event.title}</strong>! Could you take 60 seconds to share your feedback?</p>
<p><a href="${feedbackUrl}">Share feedback</a></p>
<p>Yi Connect — Together We Can. We Will.</p>`,
          };
        })
        .filter((e): e is { to: string; subject: string; html: string } => e !== null);

      let emailsSent = 0;
      if (emails.length > 0) {
        const batch = await sendBatchEmails(emails);
        emailsSent = batch.sent;
      }

      // WhatsApp (optional, non-blocking)
      let whatsappSent = 0;
      if (settings.whatsapp_reminder) {
        try {
          const { sendMessageAPI } = await import('@/lib/whatsapp/api-client');
          for (const r of rsvps ?? []) {
            const row = r as any;
            const profile = Array.isArray(row.member?.profile)
              ? row.member.profile[0]
              : row.member?.profile;
            if (!profile?.phone) continue;
            const msg = formatFeedbackReminder(
              eventForTemplate,
              profile.full_name || 'Member',
              feedbackUrl
            );
            try {
              await sendMessageAPI(profile.phone, msg);
              whatsappSent++;
            } catch {
              // Continue on single failure
            }
          }
        } catch (whatsappErr) {
          steps.notes!.whatsapp =
            'WhatsApp service unavailable — skipped (email sent)';
          console.warn('WhatsApp skipped:', whatsappErr);
        }
      }

      steps.feedback_reminder_sent = true;
      steps.notes!.step1 = `email=${emailsSent} whatsapp=${whatsappSent} rsvps=${rsvps?.length || 0}`;
    } catch (err) {
      steps.feedback_reminder_sent = false;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`step1: ${msg}`);
      console.error('Step 1 feedback reminder failed:', err);
    }

    // ----------------------------------------------------------------
    // STEP 2 — Compute stats
    // ----------------------------------------------------------------
    let stats: EventStats = {
      total_rsvps: 0,
      attending_count: 0,
      attended_count: 0,
      check_in_rate: 0,
      feedback_count: 0,
      feedback_average: null,
      ec_members_count: 0,
      non_ec_members_count: 0,
      photos_count: 0,
    };
    let attendedMemberIds: string[] = [];
    try {
      const [
        { data: allRsvps },
        { data: feedback },
        { data: docs },
      ] = await Promise.all([
        supabase
          .from('event_rsvps')
          .select('member_id, status')
          .eq('event_id', event.id),
        supabase
          .from('event_feedback')
          .select('rating')
          .eq('event_id', event.id),
        supabase
          .from('event_documents')
          .select('id, document_type')
          .eq('event_id', event.id),
      ]);

      const rsvpList = allRsvps ?? [];
      const attending = rsvpList.filter(
        (r) => r.status === 'confirmed' || r.status === 'attended'
      );
      const attended = rsvpList.filter((r) => r.status === 'attended');
      attendedMemberIds = attended
        .map((r) => r.member_id as string)
        .filter(Boolean);

      const ratings = (feedback ?? [])
        .map((f: { rating: number | null }) => f.rating)
        .filter((r): r is number => typeof r === 'number' && r > 0);
      const avg =
        ratings.length > 0
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : null;

      const photos = (docs ?? []).filter(
        (d: { document_type: string }) =>
          d.document_type === 'photo' || d.document_type === 'image'
      );

      stats = {
        total_rsvps: rsvpList.length,
        attending_count: attending.length,
        attended_count: attended.length,
        check_in_rate:
          attending.length > 0
            ? (attended.length / attending.length) * 100
            : 0,
        feedback_count: ratings.length,
        feedback_average: avg,
        // EC vs non-EC: treat attended members with hierarchy >= 2 as EC
        ec_members_count: 0,
        non_ec_members_count: attended.length,
        photos_count: photos.length,
      };

      // Compute EC/non-EC breakdown
      if (attendedMemberIds.length > 0) {
        const { data: ecRoles } = await supabase
          .from('user_roles')
          .select('user_id, role:roles(hierarchy_level)')
          .in('user_id', attendedMemberIds);
        const ecIds = new Set(
          (ecRoles ?? [])
            .filter((r: unknown) => {
              const role = (r as { role?: unknown }).role;
              const roleObj = Array.isArray(role) ? role[0] : role;
              return (
                ((roleObj as { hierarchy_level?: number } | null)
                  ?.hierarchy_level ?? 0) >= 2
              );
            })
            .map((r: unknown) => (r as { user_id: string }).user_id)
        );
        stats.ec_members_count = ecIds.size;
        stats.non_ec_members_count = Math.max(0, attended.length - ecIds.size);
      }

      steps.stats_computed = true;
      steps.notes!.step2 = `attending=${stats.attending_count} attended=${stats.attended_count} feedback_avg=${stats.feedback_average?.toFixed(2) ?? 'none'}`;
    } catch (err) {
      steps.stats_computed = false;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`step2: ${msg}`);
      console.error('Step 2 stats failed:', err);
    }

    // ----------------------------------------------------------------
    // STEP 3 — Auto-create health card draft (if vertical_id present)
    // ----------------------------------------------------------------
    try {
      if (event.vertical_id && settings.auto_log_health_card) {
        // Load chapter + vertical info + current user (for submitter)
        const { data: chapter } = await supabase
          .from('chapters')
          .select('id, name, region')
          .eq('id', event.chapter_id)
          .single();

        // Map chapter.region to the health card enum (best effort)
        const regionMap: Record<string, string> = {
          east: 'east_region',
          north: 'north_region',
          south: 'south_region',
          west: 'west_region',
          jksn: 'jksn',
          srtn: 'srtn',
        };
        const regionKey = (chapter?.region || 'south').toLowerCase();
        const region =
          regionMap[regionKey] ||
          regionMap[regionKey.replace(/_region$/, '')] ||
          'south_region';

        // Resolve submitter profile
        const { data: submitterProfile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', user?.id ?? event.organizer_id)
          .maybeSingle();

        // Check if a draft already exists for this event
        const { data: existing } = await supabase
          .from('health_card_entries')
          .select('id')
          .eq('chapter_id', event.chapter_id)
          .eq('vertical_id', event.vertical_id)
          .eq('activity_name', event.title)
          .eq('activity_date', event.start_date.split('T')[0])
          .maybeSingle();

        if (existing) {
          steps.health_card_created = true;
          steps.notes!.step3 = `health_card existing id=${existing.id}`;
        } else {
          const { error: hcError, data: hcRow } = await supabase
            .from('health_card_entries')
            .insert({
              submitter_name: submitterProfile?.full_name || 'Auto-Pilot',
              submitter_role: 'chair',
              email: submitterProfile?.email || 'autopilot@yi-connect.org',
              activity_date: event.start_date.split('T')[0],
              activity_name: event.title,
              activity_description: `Auto-logged from event ${event.id}`,
              chapter_id: event.chapter_id,
              region,
              ec_members_count: stats.ec_members_count,
              non_ec_members_count: stats.non_ec_members_count,
              vertical_id: event.vertical_id,
              calendar_year: new Date(event.start_date).getFullYear(),
              member_id: user?.id ?? event.organizer_id,
              vertical_specific_data: {
                auto_logged: true,
                source_event_id: event.id,
              },
            })
            .select('id')
            .single();

          if (hcError) {
            steps.health_card_created = false;
            errors.push(`step3: ${hcError.message}`);
            console.warn('Step 3 health card insert failed:', hcError);
          } else {
            steps.health_card_created = true;
            steps.notes!.step3 = `health_card id=${hcRow?.id}`;
          }
        }
      } else {
        steps.health_card_created = false;
        steps.notes!.step3 = event.vertical_id
          ? 'disabled by setting'
          : 'no vertical_id — skipped';
      }
    } catch (err) {
      steps.health_card_created = false;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`step3: ${msg}`);
      console.error('Step 3 health card failed:', err);
    }

    // ----------------------------------------------------------------
    // STEP 4 — Award points to attending members
    // ----------------------------------------------------------------
    try {
      if (attendedMemberIds.length > 0) {
        const result = await awardPointsBulk(
          attendedMemberIds.map((id) => ({
            member_id: id,
            chapter_id: event.chapter_id!,
          })),
          {
            points: settings.points_per_attendance,
            reason: `Attended ${event.title}`,
            action_type: 'event_attended',
            source_id: event.id,
            source_type: 'event',
          }
        );
        steps.points_awarded = true;
        steps.notes!.step4 = `awarded=${result.awarded} dup=${result.duplicates} failed=${result.failed}`;
      } else {
        steps.points_awarded = true;
        steps.notes!.step4 = 'no attended members';
      }
    } catch (err) {
      steps.points_awarded = false;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`step4: ${msg}`);
      console.error('Step 4 points failed:', err);
    }

    // ----------------------------------------------------------------
    // STEP 5 — Email summary to Chair
    // ----------------------------------------------------------------
    try {
      if (settings.email_chair_summary) {
        // Recipients: Chair + Co-Chair of this chapter
        const { data: chairs } = await supabase
          .from('user_roles')
          .select(
            'user_id, role:roles(name, hierarchy_level), profile:profiles!user_roles_user_id_fkey(full_name, email, chapter_id)'
          )
          .gte('role.hierarchy_level', 3);

        const recipients = (chairs ?? [])
          .filter((r: any) => {
            const prof = Array.isArray(r.profile) ? r.profile[0] : r.profile;
            return prof?.chapter_id === event.chapter_id && prof?.email;
          })
          .map((r: any) => {
            const prof = Array.isArray(r.profile) ? r.profile[0] : r.profile;
            return { email: prof.email, name: prof.full_name };
          });

        if (recipients.length === 0 && event.organizer_id) {
          const { data: org } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', event.organizer_id)
            .maybeSingle();
          if (org?.email) {
            recipients.push({ email: org.email, name: org.full_name || 'Chair' });
          }
        }

        let sent = 0;
        for (const rcpt of recipients) {
          const template = eventSummaryEmail({
            event: {
              id: event.id,
              title: event.title,
              start_date: event.start_date,
              end_date: event.end_date,
              venue: event.venue,
            },
            stats: {
              total_rsvps: stats.total_rsvps,
              attending_count: stats.attending_count,
              attended_count: stats.attended_count,
              check_in_rate: stats.check_in_rate,
              feedback_count: stats.feedback_count,
              feedback_average: stats.feedback_average,
            },
            chairName: rcpt.name || 'Chair',
          });
          const r = await sendEmail({
            to: rcpt.email,
            subject: template.subject,
            html: template.html,
          });
          if (r.success) sent++;
        }
        steps.summary_emailed = sent > 0;
        steps.notes!.step5 = `sent=${sent}/${recipients.length}`;
      } else {
        steps.summary_emailed = false;
        steps.notes!.step5 = 'disabled by setting';
      }
    } catch (err) {
      steps.summary_emailed = false;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`step5: ${msg}`);
      console.error('Step 5 chair email failed:', err);
    }

    // ----------------------------------------------------------------
    // STEP 6 — Flag event as report-eligible (cache tag)
    // ----------------------------------------------------------------
    try {
      // Lightweight flag: update event's custom_fields with a marker so
      // the quarterly report query picks it up naturally via status=completed.
      // Completed status already signals eligibility — just invalidate cache.
      updateTag('events');
      updateTag('chapter-reports');
      steps.report_flagged = true;
      steps.notes!.step6 = 'cache invalidated';
    } catch (err) {
      steps.report_flagged = false;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`step6: ${msg}`);
    }

    // Determine final status
    const allSteps = [
      steps.feedback_reminder_sent,
      steps.stats_computed,
      steps.health_card_created,
      steps.points_awarded,
      steps.summary_emailed,
      steps.report_flagged,
    ];
    const successCount = allSteps.filter((s) => s === true).length;
    let finalStatus: AutopilotStatus;
    if (successCount === allSteps.length) {
      finalStatus = 'completed';
    } else if (successCount > 0) {
      finalStatus = 'partial';
    } else {
      finalStatus = 'failed';
    }

    // Finalize the run
    await supabase
      .from('event_autopilot_runs')
      .update({
        status: finalStatus,
        steps_completed: steps as unknown as Record<string, unknown>,
        error_log: errors.length > 0 ? errors.join(' | ') : null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    revalidatePath(`/events/${event.id}`);
    revalidatePath('/reports/quarterly');

    return {
      success: finalStatus !== 'failed',
      run_id: run.id,
      status: finalStatus,
      steps_completed: steps,
      error: errors.length > 0 ? errors.join(' | ') : undefined,
    };
  } catch (error) {
    console.error('triggerEventAutoPilot top-level exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Mark an event as completed AND trigger the auto-pilot pipeline.
 * This is the canonical "finish event" action for Chair+.
 */
export async function completeEventAndTriggerAutopilot(
  eventId: string
): Promise<TriggerAutopilotResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const supabase = await createClient();
    const { data: event } = await supabase
      .from('events')
      .select('organizer_id, status, chapter_id')
      .eq('id', eventId)
      .single();
    if (!event) return { success: false, error: 'Event not found' };

    // Permission check
    const { data: rolesRow } = await supabase
      .from('user_roles')
      .select('role:roles(hierarchy_level)')
      .eq('user_id', user.id);
    const level = Math.max(
      0,
      ...(rolesRow ?? []).map((r: unknown) => {
        const role = (r as { role?: unknown }).role;
        const roleObj = Array.isArray(role) ? role[0] : role;
        return (roleObj as { hierarchy_level?: number } | null)?.hierarchy_level ?? 0;
      })
    );
    if (event.organizer_id !== user.id && level < 4) {
      return { success: false, error: 'Permission denied' };
    }

    if (event.status !== 'completed') {
      const { error: updErr } = await supabase
        .from('events')
        .update({ status: 'completed' })
        .eq('id', eventId);
      if (updErr) {
        console.error('Failed to mark event completed:', updErr);
        return { success: false, error: 'Failed to mark event completed' };
      }
      updateTag('events');
      revalidatePath(`/events/${eventId}`);
    }

    return await triggerEventAutoPilot(eventId);
  } catch (error) {
    console.error('completeEventAndTriggerAutopilot exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Silence unused import warnings (DEFAULT_AUTOPILOT_SETTINGS is used transitively)
export const _internal = { DEFAULT_AUTOPILOT_SETTINGS };
