'use server'

/**
 * Report Server Actions
 *
 * Server actions for managing reports in Yi Connect.
 * Handles report configuration, generation, and subscriptions.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { getDateRange } from '@/lib/data/reports'
import type {
  ReportType,
  ReportFormat,
  ReportSchedule,
  DateRangeType,
  GenerateReportRequest,
  ReportConfig,
} from '@/types/reports'

// ============================================================================
// Types
// ============================================================================

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

// ============================================================================
// Report Configuration Actions
// ============================================================================

/**
 * Create a new report configuration
 */
export async function createReportConfiguration(input: {
  name: string
  description?: string
  report_type: ReportType
  chapter_id?: string
  vertical_id?: string
  config: ReportConfig
  date_range_type: DateRangeType
  custom_start_date?: string
  custom_end_date?: string
  schedule: ReportSchedule
  schedule_day_of_week?: number
  schedule_day_of_month?: number
  schedule_time?: string
  email_recipients?: string[]
}): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('report_configurations')
      .insert({
        name: input.name,
        description: input.description,
        report_type: input.report_type,
        chapter_id: input.chapter_id,
        vertical_id: input.vertical_id,
        config: input.config,
        date_range_type: input.date_range_type,
        custom_start_date: input.custom_start_date,
        custom_end_date: input.custom_end_date,
        schedule: input.schedule,
        schedule_day_of_week: input.schedule_day_of_week,
        schedule_day_of_month: input.schedule_day_of_month,
        schedule_time: input.schedule_time || '06:00',
        email_recipients: input.email_recipients || [],
        is_active: true,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating report configuration:', error)
      return { success: false, error: 'Failed to create report configuration' }
    }

    revalidatePath('/reports')
    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Error in createReportConfiguration:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Update a report configuration
 */
export async function updateReportConfiguration(
  configId: string,
  input: Partial<{
    name: string
    description: string
    config: ReportConfig
    date_range_type: DateRangeType
    custom_start_date: string
    custom_end_date: string
    schedule: ReportSchedule
    schedule_day_of_week: number
    schedule_day_of_month: number
    schedule_time: string
    email_recipients: string[]
    is_active: boolean
  }>
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('report_configurations')
      .update({
        ...input,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', configId)

    if (error) {
      console.error('Error updating report configuration:', error)
      return { success: false, error: 'Failed to update report configuration' }
    }

    revalidatePath('/reports')
    return { success: true }
  } catch (error) {
    console.error('Error in updateReportConfiguration:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Delete a report configuration
 */
export async function deleteReportConfiguration(
  configId: string
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('report_configurations')
      .delete()
      .eq('id', configId)

    if (error) {
      console.error('Error deleting report configuration:', error)
      return { success: false, error: 'Failed to delete report configuration' }
    }

    revalidatePath('/reports')
    return { success: true }
  } catch (error) {
    console.error('Error in deleteReportConfiguration:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// Report Generation Actions
// ============================================================================

/**
 * Generate a report on-demand
 */
export async function generateReport(
  request: GenerateReportRequest
): Promise<ActionResult<{ id: string; download_url?: string }>> {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Create pending report record
    const { data: report, error: insertError } = await supabase
      .from('generated_reports')
      .insert({
        name: `${formatReportType(request.report_type)} Report`,
        report_type: request.report_type,
        format: request.format,
        chapter_id: request.chapter_id,
        parameters: request.parameters,
        date_from: request.date_from,
        date_to: request.date_to,
        generated_by: user.id,
        generation_status: 'pending',
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Error creating report record:', insertError)
      return { success: false, error: 'Failed to create report' }
    }

    // Start generation in background
    // In production, this would call an Edge Function
    startReportGeneration(report.id, request)

    revalidatePath('/reports')
    return { success: true, data: { id: report.id } }
  } catch (error) {
    console.error('Error in generateReport:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Start report generation (background process)
 */
async function startReportGeneration(
  reportId: string,
  request: GenerateReportRequest
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const startTime = Date.now()

  try {
    // Update status to generating
    await supabase
      .from('generated_reports')
      .update({ generation_status: 'generating' })
      .eq('id', reportId)

    // Fetch report data based on type
    let data: Record<string, unknown>[] = []
    let rowCount = 0

    switch (request.report_type) {
      case 'trainer_performance':
        const { data: trainerData } = await supabase
          .from('trainer_performance_data')
          .select('*')
          .order('total_sessions', { ascending: false })
        data = trainerData || []
        break

      case 'stakeholder_engagement':
        const { data: stakeholderData } = await supabase
          .from('stakeholder_engagement_data')
          .select('*')
          .order('total_sessions', { ascending: false })
        data = stakeholderData || []
        break

      case 'vertical_impact':
        const { data: verticalData } = await supabase
          .from('vertical_impact_data')
          .select('*')
          .order('performance_score', { ascending: false })
        data = verticalData || []
        break

      case 'member_activity':
        const { data: memberData } = await supabase
          .from('member_activity_data')
          .select('*')
          .order('engagement_score', { ascending: false })
        data = memberData || []
        break
    }

    rowCount = data.length

    // Create data snapshot (summary stats)
    const snapshot = createDataSnapshot(request.report_type, data)

    // Generate file based on format
    // In production, this would create actual PDF/Excel files
    const fileUrl = `/api/reports/${reportId}/download?format=${request.format}`

    const generationTime = Date.now() - startTime

    // Update report with results
    await supabase
      .from('generated_reports')
      .update({
        generation_status: 'completed',
        row_count: rowCount,
        data_snapshot: snapshot,
        file_url: fileUrl,
        generation_time_ms: generationTime,
      })
      .eq('id', reportId)

  } catch (error) {
    console.error('Report generation error:', error)
    await supabase
      .from('generated_reports')
      .update({
        generation_status: 'failed',
        error_message: error instanceof Error ? error.message : 'Generation failed',
        generation_time_ms: Date.now() - startTime,
      })
      .eq('id', reportId)
  }
}

/**
 * Create a data snapshot for quick viewing
 */
function createDataSnapshot(
  reportType: ReportType,
  data: Record<string, unknown>[]
): Record<string, unknown> {
  const summary: Record<string, number | string> = {
    total_rows: data.length,
    generated_at: new Date().toISOString(),
  }

  switch (reportType) {
    case 'trainer_performance':
      summary.total_sessions = data.reduce((sum: number, r) =>
        sum + (Number(r.total_sessions) || 0), 0)
      summary.total_students = data.reduce((sum: number, r) =>
        sum + (Number(r.total_students_impacted) || 0), 0)
      break

    case 'stakeholder_engagement':
      summary.active_stakeholders = data.filter((r) =>
        r.engagement_status === 'active').length
      summary.at_risk_stakeholders = data.filter((r) =>
        r.engagement_status === 'at_risk').length
      break

    case 'vertical_impact':
      summary.total_trainers = data.reduce((sum: number, r) =>
        sum + (Number(r.active_trainers) || 0), 0)
      summary.avg_performance = data.length > 0
        ? data.reduce((sum: number, r) =>
            sum + (Number(r.performance_score) || 0), 0) / data.length
        : 0
      break

    case 'member_activity':
      summary.avg_engagement = data.length > 0
        ? data.reduce((sum: number, r) =>
            sum + (Number(r.engagement_score) || 0), 0) / data.length
        : 0
      summary.total_awards = data.reduce((sum: number, r) =>
        sum + (Number(r.awards_received) || 0), 0)
      break
  }

  return { summary }
}

/**
 * Format report type for display
 */
function formatReportType(type: ReportType): string {
  const names: Record<ReportType, string> = {
    trainer_performance: 'Trainer Performance',
    stakeholder_engagement: 'Stakeholder Engagement',
    vertical_impact: 'Vertical Impact',
    member_activity: 'Member Activity',
    custom: 'Custom',
  }
  return names[type] || type
}

/**
 * Delete a generated report
 */
export async function deleteGeneratedReport(
  reportId: string
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('generated_reports')
      .delete()
      .eq('id', reportId)

    if (error) {
      console.error('Error deleting report:', error)
      return { success: false, error: 'Failed to delete report' }
    }

    revalidatePath('/reports')
    return { success: true }
  } catch (error) {
    console.error('Error in deleteGeneratedReport:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Track report download
 */
export async function trackReportDownload(
  reportId: string
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await getCurrentUser()

    const { error } = await supabase.rpc('increment', {
      table_name: 'generated_reports',
      row_id: reportId,
      column_name: 'download_count',
    })

    // Fallback if RPC doesn't exist
    if (error) {
      const { data: report } = await supabase
        .from('generated_reports')
        .select('download_count')
        .eq('id', reportId)
        .single()

      if (report) {
        await supabase
          .from('generated_reports')
          .update({
            download_count: (report.download_count || 0) + 1,
            last_downloaded_at: new Date().toISOString(),
            last_downloaded_by: user?.id,
          })
          .eq('id', reportId)
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Error tracking download:', error)
    return { success: false, error: 'Failed to track download' }
  }
}

// ============================================================================
// Report Subscription Actions
// ============================================================================

/**
 * Subscribe to a report
 */
export async function subscribeToReport(input: {
  configuration_id: string
  delivery_method?: 'email' | 'in_app' | 'both'
  email_address?: string
  format_preference?: ReportFormat
}): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('report_subscriptions')
      .upsert(
        {
          configuration_id: input.configuration_id,
          user_id: user.id,
          delivery_method: input.delivery_method || 'email',
          email_address: input.email_address,
          format_preference: input.format_preference || 'pdf',
          is_active: true,
          subscribed_at: new Date().toISOString(),
        },
        { onConflict: 'configuration_id,user_id' }
      )
      .select('id')
      .single()

    if (error) {
      console.error('Error subscribing to report:', error)
      return { success: false, error: 'Failed to subscribe to report' }
    }

    revalidatePath('/reports')
    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Error in subscribeToReport:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Unsubscribe from a report
 */
export async function unsubscribeFromReport(
  configurationId: string
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('report_subscriptions')
      .update({
        is_active: false,
        unsubscribed_at: new Date().toISOString(),
      })
      .eq('configuration_id', configurationId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error unsubscribing from report:', error)
      return { success: false, error: 'Failed to unsubscribe from report' }
    }

    revalidatePath('/reports')
    return { success: true }
  } catch (error) {
    console.error('Error in unsubscribeFromReport:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
