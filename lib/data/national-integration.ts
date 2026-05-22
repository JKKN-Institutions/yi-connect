// ============================================================================
// Module 10: National Integration Layer - Data Layer (Cached Fetching Functions)
// ============================================================================
// Description: Cached data fetching functions using React cache() for
//              request-level deduplication
// Version: 1.0
// Created: 2025-11-22
// ============================================================================

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentChapterId } from '@/lib/auth';
import type {
  NationalSyncConfig,
  NationalSyncLog,
  NationalSyncEntity,
  NationalBenchmark,
  NationalEvent,
  NationalEventListItem,
  NationalEventRegistration,
  RegistrationWithEvent,
  NationalLeadershipRole,
  NationalRoleMapping,
  RoleMappingWithDetails,
  NationalBroadcast,
  BroadcastWithReceipt,
  BroadcastReceipt,
  NationalDataConflict,
  SyncHealthStatus,
  BenchmarkSummary,
  NationalEventStats,
  NationalDashboardData,
  SyncLogFilters,
  SyncEntityFilters,
  BenchmarkFilters,
  NationalEventFilters,
  BroadcastFilters,
  ConflictFilters,
  PaginatedSyncLogs
} from '@/types/national-integration';

// ============================================================================
// SYNC CONFIG FUNCTIONS
// ============================================================================

/**
 * Get sync configuration for the current chapter
 */
export const getSyncConfig = cache(
  async (chapterId?: string): Promise<NationalSyncConfig | null> => {
    const supabase = await createClient();
    const cId = chapterId || (await getCurrentChapterId());

    if (!cId) return null;

    const { data, error } = await supabase
      .from('national_sync_config')
      .select('*')
      .eq('chapter_id', cId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching sync config:', error);
      return null;
    }

    return data as NationalSyncConfig | null;
  }
);

/**
 * Get sync health status using database function
 */
export const getSyncHealth = cache(
  async (chapterId?: string): Promise<SyncHealthStatus | null> => {
    const supabase = await createClient();
    const cId = chapterId || (await getCurrentChapterId());

    if (!cId) return null;

    const { data, error } = await supabase.rpc('get_sync_health_status', {
      p_chapter_id: cId
    });

    if (error) {
      console.error('Error fetching sync health:', error);
      return null;
    }

    return data as SyncHealthStatus;
  }
);

// ============================================================================
// SYNC LOG FUNCTIONS
// ============================================================================

/**
 * Get paginated sync logs with filters
 */
export const getSyncLogs = cache(
  async (
    filters?: SyncLogFilters,
    page: number = 1,
    pageSize: number = 20,
    chapterId?: string
  ): Promise<PaginatedSyncLogs> => {
    const supabase = await createClient();
    const cId = chapterId || (await getCurrentChapterId());

    if (!cId) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    let query = supabase
      .from('national_sync_logs')
      .select('*', { count: 'exact' })
      .eq('chapter_id', cId);

    // Apply filters
    if (filters?.sync_type?.length) {
      query = query.in('sync_type', filters.sync_type);
    }
    if (filters?.status?.length) {
      query = query.in('status', filters.status);
    }
    if (filters?.direction?.length) {
      query = query.in('sync_direction', filters.direction);
    }
    if (filters?.date_from) {
      query = query.gte('started_at', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('started_at', filters.date_to);
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.order('started_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching sync logs:', error);
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    return {
      data: (data as NationalSyncLog[]) || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize)
    };
  }
);

/**
 * Get single sync log by ID
 */
export const getSyncLogById = cache(
  async (logId: string): Promise<NationalSyncLog | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('national_sync_logs')
      .select('*')
      .eq('id', logId)
      .single();

    if (error) {
      console.error('Error fetching sync log:', error);
      return null;
    }

    return data as NationalSyncLog;
  }
);

/**
 * Get recent sync logs (last 10)
 */
export const getRecentSyncLogs = cache(
  async (chapterId?: string): Promise<NationalSyncLog[]> => {
    const supabase = await createClient();
    const cId = chapterId || (await getCurrentChapterId());

    if (!cId) return [];

    const { data, error } = await supabase
      .from('national_sync_logs')
      .select('*')
      .eq('chapter_id', cId)
      .order('started_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching recent sync logs:', error);
      return [];
    }

    return (data as NationalSyncLog[]) || [];
  }
);

// ============================================================================
// SYNC ENTITY FUNCTIONS
// ============================================================================

/**
 * Get sync entities with filters
 */
export const getSyncEntities = cache(
  async (
    filters?: SyncEntityFilters,
    chapterId?: string
  ): Promise<NationalSyncEntity[]> => {
    const supabase = await createClient();
    const cId = chapterId || (await getCurrentChapterId());

    if (!cId) return [];

    let query = supabase
      .from('national_sync_entities')
      .select('*')
      .eq('chapter_id', cId);

    if (filters?.entity_type?.length) {
      query = query.in('entity_type', filters.entity_type);
    }
    if (filters?.status?.length) {
      query = query.in('sync_status', filters.status);
    }
    if (filters?.has_conflict !== undefined) {
      query = query.eq('has_conflict', filters.has_conflict);
    }

    query = query.order('updated_at', { ascending: false }).limit(100);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching sync entities:', error);
      return [];
    }

    return (data as NationalSyncEntity[]) || [];
  }
);

/**
 * Get entities with conflicts
 */
export const getConflictedEntities = cache(
  async (chapterId?: string): Promise<NationalSyncEntity[]> => {
    return getSyncEntities({ has_conflict: true }, chapterId);
  }
);

// ============================================================================
// BENCHMARK FUNCTIONS
// ============================================================================

/**
 * Get benchmarks with filters
 */
export const getBenchmarks = cache(
  async (
    filters?: BenchmarkFilters,
    chapterId?: string
  ): Promise<NationalBenchmark[]> => {
    const supabase = await createClient();
    const cId = chapterId || (await getCurrentChapterId());

    if (!cId) return [];

    let query = supabase
      .from('national_benchmarks')
      .select('*')
      .eq('chapter_id', cId);

    if (filters?.metric_type?.length) {
      query = query.in('metric_type', filters.metric_type);
    }
    if (filters?.period_type) {
      query = query.eq('period_type', filters.period_type);
    }
    if (filters?.performance_tier?.length) {
      query = query.in('performance_tier', filters.performance_tier);
    }
    if (filters?.calendar_year) {
      query = query.eq('calendar_year', filters.calendar_year);
    }
    if (filters?.quarter) {
      query = query.eq('quarter', filters.quarter);
    }

    query = query.order('period_end', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching benchmarks:', error);
      return [];
    }

    return (data as NationalBenchmark[]) || [];
  }
);

/**
 * Get benchmark summary using database function
 */
export const getBenchmarkSummary = cache(
  async (
    periodType: 'monthly' | 'quarterly' | 'yearly' = 'quarterly',
    chapterId?: string
  ): Promise<BenchmarkSummary | null> => {
    const supabase = await createClient();
    const cId = chapterId || (await getCurrentChapterId());

    if (!cId) return null;

    const { data, error } = await supabase.rpc('get_benchmark_summary', {
      p_chapter_id: cId,
      p_period_type: periodType
    });

    if (error) {
      console.error('Error fetching benchmark summary:', error);
      return null;
    }

    return data as BenchmarkSummary;
  }
);

// ============================================================================
// NATIONAL EVENT FUNCTIONS
// ============================================================================

/**
 * Get national events with filters
 */
export const getNationalEvents = cache(
  async (filters?: NationalEventFilters): Promise<NationalEventListItem[]> => {
    const supabase = await createClient();

    let query = supabase
      .from('national_events')
      .select(
        `
        id,
        national_event_id,
        title,
        event_type,
        start_date,
        end_date,
        city,
        is_virtual,
        status,
        is_featured,
        current_registrations,
        max_participants,
        registration_deadline
      `
      )
      .order('start_date', { ascending: true });

    if (filters?.event_type?.length) {
      query = query.in('event_type', filters.event_type);
    }
    if (filters?.status?.length) {
      query = query.in('status', filters.status);
    }
    if (filters?.date_from) {
      query = query.gte('start_date', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('start_date', filters.date_to);
    }
    if (filters?.is_virtual !== undefined) {
      query = query.eq('is_virtual', filters.is_virtual);
    }
    if (filters?.search) {
      query = query.or(
        `title.ilike.%${filters.search}%,city.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching national events:', error);
      return [];
    }

    return (data as NationalEventListItem[]) || [];
  }
);

/**
 * Get upcoming national events
 */
export const getUpcomingNationalEvents = cache(
  async (limit: number = 5): Promise<NationalEventListItem[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('national_events')
      .select(
        `
        id,
        national_event_id,
        title,
        event_type,
        start_date,
        end_date,
        city,
        is_virtual,
        status,
        is_featured,
        current_registrations,
        max_participants,
        registration_deadline
      `
      )
      .in('status', ['upcoming', 'registration_open'])
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching upcoming events:', error);
      return [];
    }

    return (data as NationalEventListItem[]) || [];
  }
);

/**
 * Get single national event by ID
 */
export const getNationalEventById = cache(
  async (eventId: string): Promise<NationalEvent | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('national_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error) {
      console.error('Error fetching national event:', error);
      return null;
    }

    return data as NationalEvent;
  }
);

/**
 * Get national event stats for chapter
 */
export const getNationalEventStats = cache(
  async (chapterId?: string): Promise<NationalEventStats | null> => {
    const supabase = await createClient();
    const cId = chapterId || (await getCurrentChapterId());

    if (!cId) return null;

    const { data, error } = await supabase.rpc('get_national_event_stats', {
      p_chapter_id: cId
    });

    if (error) {
      console.error('Error fetching event stats:', error);
      return null;
    }

    return data as NationalEventStats;
  }
);

// ============================================================================
// EVENT REGISTRATION FUNCTIONS
// ============================================================================

/**
 * Get member's registrations with event details
 */
export const getMemberRegistrations = cache(
  async (memberId: string): Promise<RegistrationWithEvent[]> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('national_event_registrations')
      .select(
        `
        *,
        national_event:national_events (
          id,
          national_event_id,
          title,
          event_type,
          start_date,
          end_date,
          city,
          is_virtual,
          status,
          is_featured,
          current_registrations,
          max_participants,
          registration_deadline
        )
      `
      )
      .eq('member_id', memberId)
      .order('registered_at', { ascending: false });

    if (error) {
      console.error('Error fetching member registrations:', error);
      return [];
    }

    return (data as unknown as RegistrationWithEvent[]) || [];
  }
);

/**
 * Get registration by ID
 */
export const getRegistrationById = cache(
  async (registrationId: string): Promise<NationalEventRegistration | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('national_event_registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (error) {
      console.error('Error fetching registration:', error);
      return null;
    }

    return data as NationalEventRegistration;
  }
);

/**
 * Check if member is registered for an event
 */
export const checkMemberRegistration = cache(
  async (
    eventId: string,
    memberId: string
  ): Promise<NationalEventRegistration | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('national_event_registrations')
      .select('*')
      .eq('national_event_id', eventId)
      .eq('member_id', memberId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking registration:', error);
    }

    return data as NationalEventRegistration | null;
  }
);

// ============================================================================
// LEADERSHIP DIRECTORY FUNCTIONS
// ============================================================================

/**
 * Get all leadership roles
 */
export const getLeadershipRoles = cache(
  async (activeOnly: boolean = true): Promise<NationalLeadershipRole[]> => {
    const supabase = await createClient();

    let query = supabase
      .from('national_leadership_directory')
      .select('*')
      .order('hierarchy_level', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching leadership roles:', error);
      return [];
    }

    return (data as NationalLeadershipRole[]) || [];
  }
);

/**
 * Get chapter's role mappings
 */
export const getRoleMappings = cache(
  async (chapterId?: string): Promise<RoleMappingWithDetails[]> => {
    const supabase = await createClient();
    const cId = chapterId || (await getCurrentChapterId());

    if (!cId) return [];

    const { data, error } = await supabase
      .from('national_role_mappings')
      .select(
        `
        *,
        national_role:national_leadership_directory (*),
        member:members!member_id (
          id,
          profiles!inner (full_name)
        )
      `
      )
      .eq('chapter_id', cId)
      .eq('status', 'active')
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error('Error fetching role mappings:', error);
      return [];
    }

    // Transform the data to match expected type
    const transformed = (data || []).map((item: Record<string, unknown>) => ({
      ...item,
      member: {
        id: (item.member as Record<string, unknown>)?.id,
        full_name: ((item.member as Record<string, unknown>)?.profiles as Record<string, unknown>)?.full_name
      }
    }));

    return transformed as unknown as RoleMappingWithDetails[];
  }
);

// ============================================================================
// BROADCAST FUNCTIONS
// ============================================================================

/**
 * Get broadcasts with optional read status
 */
export const getBroadcasts = cache(
  async (
    filters?: BroadcastFilters,
    memberId?: string
  ): Promise<BroadcastWithReceipt[]> => {
    const supabase = await createClient();

    let query = supabase
      .from('national_broadcasts')
      .select('*')
      .order('published_at', { ascending: false });

    if (filters?.broadcast_type?.length) {
      query = query.in('broadcast_type', filters.broadcast_type);
    }
    if (filters?.priority?.length) {
      query = query.in('priority', filters.priority);
    }
    if (filters?.requires_acknowledgment !== undefined) {
      query = query.eq('requires_acknowledgment', filters.requires_acknowledgment);
    }
    if (filters?.date_from) {
      query = query.gte('published_at', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('published_at', filters.date_to);
    }
    if (filters?.search) {
      query = query.or(
        `title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`
      );
    }

    const { data: broadcasts, error } = await query;

    if (error) {
      console.error('Error fetching broadcasts:', error);
      return [];
    }

    if (!memberId) {
      return (broadcasts as NationalBroadcast[]).map((b) => ({ ...b }));
    }

    // Get receipts for the member
    const broadcastIds = broadcasts?.map((b) => b.id) || [];
    const { data: receipts } = await supabase
      .from('national_broadcast_receipts')
      .select('*')
      .eq('member_id', memberId)
      .in('broadcast_id', broadcastIds);

    const receiptMap = new Map(
      (receipts || []).map((r: BroadcastReceipt) => [r.broadcast_id, r])
    );

    let result = (broadcasts as NationalBroadcast[]).map((b) => ({
      ...b,
      receipt: receiptMap.get(b.id)
    }));

    // Filter by read status if specified
    if (filters?.read_status === 'read') {
      result = result.filter((b) => b.receipt?.read_at);
    } else if (filters?.read_status === 'unread') {
      result = result.filter((b) => !b.receipt?.read_at);
    }

    return result;
  }
);

/**
 * Get unread broadcasts count
 */
export const getUnreadBroadcastsCount = cache(
  async (memberId: string): Promise<number> => {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('get_unread_broadcasts_count', {
      p_member_id: memberId
    });

    if (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }

    return data as number;
  }
);

/**
 * Get single broadcast by ID
 */
export const getBroadcastById = cache(
  async (broadcastId: string): Promise<NationalBroadcast | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('national_broadcasts')
      .select('*')
      .eq('id', broadcastId)
      .single();

    if (error) {
      console.error('Error fetching broadcast:', error);
      return null;
    }

    return data as NationalBroadcast;
  }
);

// ============================================================================
// DATA CONFLICT FUNCTIONS
// ============================================================================

/**
 * Get data conflicts with filters
 */
export const getDataConflicts = cache(
  async (
    filters?: ConflictFilters,
    chapterId?: string
  ): Promise<NationalDataConflict[]> => {
    const supabase = await createClient();
    const cId = chapterId || (await getCurrentChapterId());

    if (!cId) return [];

    let query = supabase
      .from('national_data_conflicts')
      .select('*')
      .eq('chapter_id', cId);

    if (filters?.entity_type?.length) {
      query = query.in('entity_type', filters.entity_type);
    }
    if (filters?.conflict_type?.length) {
      query = query.in('conflict_type', filters.conflict_type);
    }
    if (filters?.resolution_status?.length) {
      query = query.in('resolution_status', filters.resolution_status);
    }
    if (filters?.priority?.length) {
      query = query.in('priority', filters.priority);
    }
    if (filters?.date_from) {
      query = query.gte('detected_at', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('detected_at', filters.date_to);
    }

    query = query.order('detected_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching conflicts:', error);
      return [];
    }

    return (data as NationalDataConflict[]) || [];
  }
);

/**
 * Get pending conflicts count
 */
export const getPendingConflictsCount = cache(
  async (chapterId?: string): Promise<number> => {
    const supabase = await createClient();
    const cId = chapterId || (await getCurrentChapterId());

    if (!cId) return 0;

    const { count, error } = await supabase
      .from('national_data_conflicts')
      .select('*', { count: 'exact', head: true })
      .eq('chapter_id', cId)
      .eq('resolution_status', 'pending');

    if (error) {
      console.error('Error fetching conflict count:', error);
      return 0;
    }

    return count || 0;
  }
);

/**
 * Get single conflict by ID
 */
export const getConflictById = cache(
  async (conflictId: string): Promise<NationalDataConflict | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('national_data_conflicts')
      .select('*')
      .eq('id', conflictId)
      .single();

    if (error) {
      console.error('Error fetching conflict:', error);
      return null;
    }

    return data as NationalDataConflict;
  }
);

// ============================================================================
// DASHBOARD DATA FUNCTION
// ============================================================================

/**
 * Get all dashboard data in one call
 */
export const getNationalDashboardData = cache(
  async (
    chapterId?: string,
    memberId?: string
  ): Promise<NationalDashboardData | null> => {
    const cId = chapterId || (await getCurrentChapterId());

    if (!cId) return null;

    // Fetch all data in parallel
    const [
      syncHealth,
      benchmarkSummary,
      eventStats,
      unreadBroadcasts,
      pendingConflicts,
      recentSyncLogs,
      upcomingEvents
    ] = await Promise.all([
      getSyncHealth(cId),
      getBenchmarkSummary('quarterly', cId),
      getNationalEventStats(cId),
      memberId ? getUnreadBroadcastsCount(memberId) : Promise.resolve(0),
      getPendingConflictsCount(cId),
      getRecentSyncLogs(cId),
      getUpcomingNationalEvents(5)
    ]);

    return {
      sync_health: syncHealth || {
        sync_enabled: false,
        connection_status: 'disconnected',
        last_successful_sync: null,
        consecutive_failures: 0,
        last_24h: {
          successful_syncs: 0,
          failed_syncs: 0,
          in_progress: 0,
          records_synced: 0,
          records_failed: 0
        },
        pending_conflicts: 0,
        entities_synced: 0,
        health_score: 0
      },
      benchmark_summary: benchmarkSummary || {
        benchmarks: [],
        average_percentile: 0,
        top_performing_metrics: [],
        improvement_areas: [],
        overall_tier: 'average'
      },
      event_stats: eventStats || {
        total_registrations: 0,
        confirmed: 0,
        attended: 0,
        attendance_rate: 0,
        upcoming_events: 0
      },
      unread_broadcasts: unreadBroadcasts,
      pending_conflicts: pendingConflicts,
      recent_sync_logs: recentSyncLogs,
      upcoming_events: upcomingEvents
    };
  }
);

// ============================================================================
// End of Data Layer
// ============================================================================
