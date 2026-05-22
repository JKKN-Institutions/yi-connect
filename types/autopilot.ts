/**
 * Event Auto-Pilot Types
 *
 * Type definitions for the Event Auto-Pilot pipeline and audit log.
 */

export type AutopilotStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'partial';

export interface AutopilotStepsCompleted {
  feedback_reminder_sent?: boolean;
  stats_computed?: boolean;
  health_card_created?: boolean;
  points_awarded?: boolean;
  summary_emailed?: boolean;
  report_flagged?: boolean;
  // per-step free-form notes (e.g. "whatsapp skipped - not connected")
  notes?: Record<string, string>;
}

export interface EventAutopilotRun {
  id: string;
  event_id: string;
  chapter_id: string;
  triggered_at: string;
  triggered_by: string | null;
  status: AutopilotStatus;
  steps_completed: AutopilotStepsCompleted;
  error_log: string | null;
  completed_at: string | null;
}

/**
 * Per-chapter auto-pilot configuration stored in
 * chapter_feature_toggles.settings (JSONB).
 */
export interface AutopilotSettings {
  /** Hours after event end to send feedback reminder (default 24) */
  feedback_reminder_hours: number;
  /** Whether to auto-log a draft health card entry when event has vertical_id */
  auto_log_health_card: boolean;
  /** Whether to award points for event attendance (default 10) */
  points_per_attendance: number;
  /** Whether to send summary email to Chair (default true) */
  email_chair_summary: boolean;
  /** Whether to send WhatsApp reminder (requires whatsapp connection) */
  whatsapp_reminder: boolean;
}

export const DEFAULT_AUTOPILOT_SETTINGS: AutopilotSettings = {
  feedback_reminder_hours: 24,
  auto_log_health_card: true,
  points_per_attendance: 10,
  email_chair_summary: true,
  whatsapp_reminder: true,
};

/**
 * Summary stats computed in step 2 of the pipeline.
 */
export interface EventStats {
  total_rsvps: number;
  attending_count: number;
  attended_count: number;
  check_in_rate: number; // percentage 0-100
  feedback_count: number;
  feedback_average: number | null; // 1-5 or null if no feedback
  ec_members_count: number;
  non_ec_members_count: number;
  photos_count: number;
}

export interface TriggerAutopilotResult {
  success: boolean;
  run_id?: string;
  status?: AutopilotStatus;
  steps_completed?: AutopilotStepsCompleted;
  error?: string;
}

export interface MemberPointsLogEntry {
  id: string;
  member_id: string;
  chapter_id: string;
  points: number;
  reason: string;
  action_type: string;
  source_id: string | null;
  source_type: string | null;
  awarded_at: string;
}
