// ============================================================================
// Module 10: National Integration Layer - TypeScript Type Definitions
// ============================================================================
// Description: Comprehensive type definitions for national sync, benchmarks,
//              events, leadership, broadcasts, and conflict resolution
// Version: 1.0
// Created: 2025-11-22
// ============================================================================

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

export const SYNC_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'failed',
  'partial',
  'cancelled'
] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const SYNC_DIRECTIONS = ['inbound', 'outbound', 'bidirectional'] as const;
export type SyncDirection = (typeof SYNC_DIRECTIONS)[number];

export const SYNC_ENTITY_TYPES = [
  'members',
  'events',
  'financials',
  'awards',
  'projects',
  'verticals',
  'leadership'
] as const;
export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number];

export const SYNC_FREQUENCIES = [
  'realtime',
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'manual'
] as const;
export type SyncFrequency = (typeof SYNC_FREQUENCIES)[number];

export const BENCHMARK_METRICS = [
  'event_count',
  'member_engagement',
  'csr_value',
  'vertical_impact',
  'membership_growth',
  'volunteer_hours',
  'sponsorship_raised',
  'awards_won'
] as const;
export type BenchmarkMetric = (typeof BENCHMARK_METRICS)[number];

export const BENCHMARK_PERIODS = ['monthly', 'quarterly', 'yearly'] as const;
export type BenchmarkPeriod = (typeof BENCHMARK_PERIODS)[number];

export const NATIONAL_EVENT_TYPES = [
  'rcm',
  'summit',
  'yuva_conclave',
  'national_meet',
  'training',
  'workshop',
  'conference',
  'other'
] as const;
export type NationalEventType = (typeof NATIONAL_EVENT_TYPES)[number];

export const REGISTRATION_STATUSES = [
  'pending',
  'confirmed',
  'waitlisted',
  'cancelled',
  'attended',
  'no_show'
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const BROADCAST_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type BroadcastPriority = (typeof BROADCAST_PRIORITIES)[number];

export const BROADCAST_TYPES = [
  'announcement',
  'directive',
  'update',
  'alert',
  'newsletter'
] as const;
export type BroadcastType = (typeof BROADCAST_TYPES)[number];

export const CONFLICT_TYPES = [
  'data_mismatch',
  'version_conflict',
  'missing_local',
  'missing_national',
  'schema_change'
] as const;
export type ConflictType = (typeof CONFLICT_TYPES)[number];

export const CONFLICT_RESOLUTIONS = [
  'pending',
  'keep_local',
  'accept_national',
  'merged',
  'ignored'
] as const;
export type ConflictResolution = (typeof CONFLICT_RESOLUTIONS)[number];

export const PERFORMANCE_TIERS = [
  'top_10',
  'above_average',
  'average',
  'below_average',
  'bottom_10'
] as const;
export type PerformanceTier = (typeof PERFORMANCE_TIERS)[number];

export const CONNECTION_STATUSES = [
  'connected',
  'disconnected',
  'unstable',
  'error'
] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

// ============================================================================
// SYNC CONFIG TYPES
// ============================================================================

export type EntitySyncSettings = {
  enabled: boolean;
  frequency: SyncFrequency;
};

export type EntitySyncConfig = {
  members: EntitySyncSettings;
  events: EntitySyncSettings;
  financials: EntitySyncSettings;
  awards: EntitySyncSettings;
  projects: EntitySyncSettings;
  verticals?: EntitySyncSettings;
  leadership?: EntitySyncSettings;
};

export type NationalSyncConfig = {
  id: string;
  chapter_id: string;
  api_endpoint: string;
  api_version: string;
  auth_token_encrypted: string | null;
  sync_enabled: boolean;
  sync_frequency: SyncFrequency;
  entity_sync_settings: EntitySyncConfig;
  connection_status: ConnectionStatus;
  last_connection_test: string | null;
  last_successful_sync: string | null;
  last_failed_sync: string | null;
  consecutive_failures: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SyncConfigFormData = {
  api_endpoint: string;
  api_version: string;
  auth_token?: string;
  sync_enabled: boolean;
  sync_frequency: SyncFrequency;
  entity_sync_settings: EntitySyncConfig;
};

// ============================================================================
// SYNC LOG TYPES
// ============================================================================

export type NationalSyncLog = {
  id: string;
  chapter_id: string;
  sync_type: SyncEntityType;
  sync_direction: SyncDirection;
  status: SyncStatus;
  total_records: number;
  records_processed: number;
  records_succeeded: number;
  records_failed: number;
  records_skipped: number;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  error_details: Record<string, unknown> | null;
  failed_records: unknown[];
  triggered_by: string;
  triggered_by_user: string | null;
  request_id: string | null;
  api_response_code: number | null;
  api_response_time_ms: number | null;
  created_at: string;
};

export type SyncLogFilters = {
  sync_type?: SyncEntityType[];
  status?: SyncStatus[];
  direction?: SyncDirection[];
  date_from?: string;
  date_to?: string;
  search?: string;
};

export type PaginatedSyncLogs = {
  data: NationalSyncLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// ============================================================================
// SYNC ENTITY TYPES
// ============================================================================

export type NationalSyncEntity = {
  id: string;
  chapter_id: string;
  entity_type: SyncEntityType;
  local_entity_id: string;
  national_entity_id: string | null;
  sync_status: SyncStatus;
  last_synced_at: string | null;
  last_sync_log_id: string | null;
  local_version: number;
  national_version: number | null;
  local_checksum: string | null;
  national_checksum: string | null;
  has_conflict: boolean;
  conflict_detected_at: string | null;
  conflict_id: string | null;
  last_synced_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type SyncEntityFilters = {
  entity_type?: SyncEntityType[];
  status?: SyncStatus[];
  has_conflict?: boolean;
  search?: string;
};

// ============================================================================
// BENCHMARK TYPES
// ============================================================================

export type NationalBenchmark = {
  id: string;
  chapter_id: string;
  metric_type: BenchmarkMetric;
  metric_name: string;
  metric_description: string | null;
  chapter_value: number;
  regional_avg: number | null;
  national_avg: number | null;
  regional_rank: number | null;
  regional_total: number | null;
  national_rank: number | null;
  national_total: number | null;
  percentile_rank: number | null;
  performance_tier: PerformanceTier | null;
  period_type: BenchmarkPeriod;
  period_start: string;
  period_end: string;
  fiscal_year: number | null;
  quarter: number | null;
  previous_value: number | null;
  change_percentage: number | null;
  trend: 'improving' | 'stable' | 'declining' | null;
  synced_from_national_at: string | null;
  national_benchmark_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BenchmarkFilters = {
  metric_type?: BenchmarkMetric[];
  period_type?: BenchmarkPeriod;
  performance_tier?: PerformanceTier[];
  fiscal_year?: number;
  quarter?: number;
};

export type BenchmarkSummary = {
  benchmarks: NationalBenchmark[];
  average_percentile: number;
  top_performing_metrics: BenchmarkMetric[];
  improvement_areas: BenchmarkMetric[];
  overall_tier: PerformanceTier;
};

export type BenchmarkComparison = {
  metric_type: BenchmarkMetric;
  metric_name: string;
  chapter_value: number;
  regional_avg: number;
  national_avg: number;
  percentile_rank: number;
  trend: 'improving' | 'stable' | 'declining';
};

// ============================================================================
// NATIONAL EVENT TYPES
// ============================================================================

export type NationalEventSpeaker = {
  name: string;
  designation: string;
  organization: string;
  photo_url?: string;
  bio?: string;
};

export type NationalEventAgendaItem = {
  time: string;
  title: string;
  description?: string;
  speaker?: string;
};

export type NationalEventResource = {
  title: string;
  type: 'document' | 'video' | 'link';
  url: string;
};

export type NationalEvent = {
  id: string;
  national_event_id: string;
  title: string;
  description: string | null;
  event_type: NationalEventType;
  start_date: string;
  end_date: string;
  registration_deadline: string | null;
  early_bird_deadline: string | null;
  venue_name: string | null;
  venue_address: string | null;
  city: string | null;
  state: string | null;
  is_virtual: boolean;
  virtual_link: string | null;
  max_participants: number | null;
  current_registrations: number;
  waitlist_count: number;
  registration_fee: number;
  early_bird_fee: number | null;
  member_fee: number | null;
  eligible_roles: string[];
  min_chapter_quota: number | null;
  max_chapter_quota: number | null;
  status:
    | 'upcoming'
    | 'registration_open'
    | 'registration_closed'
    | 'ongoing'
    | 'completed'
    | 'cancelled';
  is_featured: boolean;
  agenda: NationalEventAgendaItem[] | null;
  speakers: NationalEventSpeaker[];
  resources: NationalEventResource[];
  last_synced_at: string;
  sync_status: SyncStatus;
  created_at: string;
  updated_at: string;
};

export type NationalEventFilters = {
  event_type?: NationalEventType[];
  status?: string[];
  date_from?: string;
  date_to?: string;
  is_virtual?: boolean;
  search?: string;
};

export type NationalEventListItem = Pick<
  NationalEvent,
  | 'id'
  | 'national_event_id'
  | 'title'
  | 'event_type'
  | 'start_date'
  | 'end_date'
  | 'city'
  | 'is_virtual'
  | 'status'
  | 'is_featured'
  | 'current_registrations'
  | 'max_participants'
  | 'registration_deadline'
>;

// ============================================================================
// EVENT REGISTRATION TYPES
// ============================================================================

export type NationalEventRegistration = {
  id: string;
  chapter_id: string;
  national_event_id: string;
  member_id: string;
  status: RegistrationStatus;
  registration_number: string | null;
  registered_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  attended_at: string | null;
  payment_status: 'not_required' | 'pending' | 'paid' | 'refunded';
  payment_amount: number | null;
  payment_reference: string | null;
  requires_accommodation: boolean;
  accommodation_status: string | null;
  travel_mode: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  special_requirements: string | null;
  attendance_verified: boolean;
  attendance_verified_by: string | null;
  feedback_submitted: boolean;
  feedback_rating: number | null;
  feedback_comments: string | null;
  certificate_eligible: boolean;
  certificate_issued: boolean;
  certificate_url: string | null;
  certificate_issued_at: string | null;
  national_registration_id: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RegistrationWithEvent = NationalEventRegistration & {
  national_event: NationalEventListItem;
};

export type RegistrationWithMember = NationalEventRegistration & {
  member: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
  };
};

export type RegistrationFormData = {
  national_event_id: string;
  requires_accommodation?: boolean;
  travel_mode?: string;
  arrival_date?: string;
  departure_date?: string;
  special_requirements?: string;
};

// ============================================================================
// LEADERSHIP DIRECTORY TYPES
// ============================================================================

export type NationalLeadershipRole = {
  id: string;
  role_code: string;
  role_name: string;
  role_description: string | null;
  hierarchy_level: number;
  parent_role_code: string | null;
  role_category: 'national' | 'regional' | 'chapter' | 'vertical' | 'special';
  is_elected: boolean;
  term_duration_months: number;
  eligibility_requirements: Record<string, unknown>;
  min_tenure_months: number | null;
  required_trainings: string[];
  is_active: boolean;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
};

export type NationalRoleMapping = {
  id: string;
  chapter_id: string;
  member_id: string;
  national_role_id: string;
  local_role_id: string | null;
  assigned_at: string;
  valid_from: string;
  valid_until: string | null;
  status: 'active' | 'pending_approval' | 'expired' | 'revoked';
  approved_by_national: boolean;
  national_approval_at: string | null;
  national_assignment_id: string | null;
  sync_status: SyncStatus;
  last_synced_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type RoleMappingWithDetails = NationalRoleMapping & {
  national_role: NationalLeadershipRole;
  member: {
    id: string;
    full_name: string;
  };
};

// ============================================================================
// BROADCAST TYPES
// ============================================================================

export type BroadcastAttachment = {
  name: string;
  url: string;
  type: string;
  size_kb?: number;
};

export type NationalBroadcast = {
  id: string;
  national_broadcast_id: string;
  title: string;
  content: string;
  content_html: string | null;
  summary: string | null;
  broadcast_type: BroadcastType;
  priority: BroadcastPriority;
  target_audience: Record<string, unknown>;
  target_roles: string[];
  target_regions: string[];
  published_at: string;
  expires_at: string | null;
  attachments: BroadcastAttachment[];
  requires_acknowledgment: boolean;
  acknowledgment_deadline: string | null;
  allows_comments: boolean;
  original_language: string;
  translations: Record<string, string>;
  received_at: string;
  created_at: string;
  updated_at: string;
};

export type BroadcastReceipt = {
  id: string;
  chapter_id: string;
  broadcast_id: string;
  member_id: string;
  received_at: string;
  read_at: string | null;
  acknowledged_at: string | null;
  response_text: string | null;
  created_at: string;
};

export type BroadcastWithReceipt = NationalBroadcast & {
  receipt?: BroadcastReceipt;
};

export type BroadcastFilters = {
  broadcast_type?: BroadcastType[];
  priority?: BroadcastPriority[];
  read_status?: 'read' | 'unread' | 'all';
  requires_acknowledgment?: boolean;
  date_from?: string;
  date_to?: string;
  search?: string;
};

// ============================================================================
// DATA CONFLICT TYPES
// ============================================================================

export type NationalDataConflict = {
  id: string;
  chapter_id: string;
  entity_type: SyncEntityType;
  local_entity_id: string;
  national_entity_id: string | null;
  sync_entity_id: string | null;
  conflict_type: ConflictType;
  conflict_fields: string[];
  local_data: Record<string, unknown>;
  national_data: Record<string, unknown>;
  diff_data: Record<string, unknown> | null;
  resolution_status: ConflictResolution;
  resolution_notes: string | null;
  resolved_data: Record<string, unknown> | null;
  resolved_by: string | null;
  resolved_at: string | null;
  auto_resolved: boolean;
  priority: 'low' | 'normal' | 'high' | 'critical';
  detected_in_sync_log_id: string | null;
  detected_at: string;
  created_at: string;
  updated_at: string;
};

export type ConflictFilters = {
  entity_type?: SyncEntityType[];
  conflict_type?: ConflictType[];
  resolution_status?: ConflictResolution[];
  priority?: string[];
  date_from?: string;
  date_to?: string;
};

export type ConflictResolutionData = {
  resolution: ConflictResolution;
  resolution_notes?: string;
  resolved_data?: Record<string, unknown>;
};

// ============================================================================
// SYNC HEALTH & DASHBOARD TYPES
// ============================================================================

export type SyncHealthStatus = {
  sync_enabled: boolean;
  connection_status: ConnectionStatus;
  last_successful_sync: string | null;
  consecutive_failures: number;
  last_24h: {
    successful_syncs: number;
    failed_syncs: number;
    in_progress: number;
    records_synced: number;
    records_failed: number;
  };
  pending_conflicts: number;
  entities_synced: number;
  health_score: number;
};

export type NationalEventStats = {
  total_registrations: number;
  confirmed: number;
  attended: number;
  attendance_rate: number;
  upcoming_events: number;
};

export type NationalDashboardData = {
  sync_health: SyncHealthStatus;
  benchmark_summary: BenchmarkSummary;
  event_stats: NationalEventStats;
  unread_broadcasts: number;
  pending_conflicts: number;
  recent_sync_logs: NationalSyncLog[];
  upcoming_events: NationalEventListItem[];
};

// ============================================================================
// API RESPONSE TYPES (for mock/real API)
// ============================================================================

export type NationalApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    request_id: string;
    timestamp: string;
    api_version: string;
  };
};

export type SyncPayload = {
  entity_type: SyncEntityType;
  direction: SyncDirection;
  entities: Array<{
    local_id: string;
    data: Record<string, unknown>;
    checksum: string;
    version: number;
  }>;
};

export type SyncResult = {
  synced: number;
  failed: number;
  conflicts: number;
  entities: Array<{
    local_id: string;
    national_id: string;
    status: 'synced' | 'failed' | 'conflict';
    error?: string;
  }>;
};

// ============================================================================
// ACTION RESULT TYPES
// ============================================================================

export type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

// ============================================================================
// End of Types
// ============================================================================
