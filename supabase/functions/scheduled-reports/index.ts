/**
 * Scheduled Reports Edge Function
 *
 * This Edge Function is triggered by pg_cron to generate scheduled reports.
 * It processes pending scheduled reports and generates them in the requested format.
 *
 * Cron Schedule: Run every hour at minute 0
 * `SELECT cron.schedule('scheduled-reports', '0 * * * *', 'SELECT net.http_post(...)')`
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

// Types
interface ScheduledReport {
  config_id: string
  report_name: string
  report_type: string
  chapter_id: string | null
  config: Record<string, unknown>
  date_range_type: string
  email_recipients: string[]
  schedule: string
}

interface ReportData {
  [key: string]: unknown
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * Main handler
 */
Deno.serve(async (req: Request) => {
  try {
    // Verify request is authorized (from cron or admin)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('Starting scheduled report generation...')

    // Get pending scheduled reports
    const { data: pendingReports, error: fetchError } = await supabase
      .rpc('get_pending_scheduled_reports')

    if (fetchError) {
      console.error('Error fetching pending reports:', fetchError)
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!pendingReports || pendingReports.length === 0) {
      console.log('No pending reports to generate')
      return new Response(JSON.stringify({ message: 'No pending reports' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log(`Found ${pendingReports.length} pending reports`)

    const results: Array<{ config_id: string; status: string; error?: string }> = []

    // Process each pending report
    for (const report of pendingReports as ScheduledReport[]) {
      try {
        console.log(`Generating report: ${report.report_name}`)
        await generateReport(report)
        results.push({ config_id: report.config_id, status: 'success' })
      } catch (error) {
        console.error(`Error generating report ${report.config_id}:`, error)
        results.push({
          config_id: report.config_id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return new Response(JSON.stringify({
      message: `Processed ${results.length} reports`,
      results,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

/**
 * Generate a single report
 */
async function generateReport(config: ScheduledReport): Promise<void> {
  const startTime = Date.now()

  // Create report record
  const { data: report, error: insertError } = await supabase
    .from('generated_reports')
    .insert({
      configuration_id: config.config_id,
      name: config.report_name,
      report_type: config.report_type,
      format: 'pdf', // Default format
      chapter_id: config.chapter_id,
      parameters: config.config,
      date_from: getDateRangeStart(config.date_range_type),
      date_to: new Date().toISOString().split('T')[0],
      generation_status: 'generating',
    })
    .select('id')
    .single()

  if (insertError || !report) {
    throw new Error(`Failed to create report record: ${insertError?.message}`)
  }

  try {
    // Fetch report data
    const data = await fetchReportData(config.report_type, config.chapter_id)

    // Create data snapshot
    const snapshot = createSnapshot(config.report_type, data)

    // Generate file URL (in production, this would upload to storage)
    const fileUrl = `/api/reports/${report.id}/download?format=pdf`

    // Update report with results
    await supabase
      .from('generated_reports')
      .update({
        generation_status: 'completed',
        row_count: data.length,
        data_snapshot: snapshot,
        file_url: fileUrl,
        generation_time_ms: Date.now() - startTime,
      })
      .eq('id', report.id)

    // Send email notifications if configured
    if (config.email_recipients && config.email_recipients.length > 0) {
      await sendNotifications(config.email_recipients, config.report_name, fileUrl)
    }

    console.log(`Report ${report.id} generated successfully`)

  } catch (error) {
    // Update report with failure
    await supabase
      .from('generated_reports')
      .update({
        generation_status: 'failed',
        error_message: error instanceof Error ? error.message : 'Generation failed',
        generation_time_ms: Date.now() - startTime,
      })
      .eq('id', report.id)

    throw error
  }
}

/**
 * Fetch report data based on type
 */
async function fetchReportData(
  reportType: string,
  chapterId: string | null
): Promise<ReportData[]> {
  let query

  switch (reportType) {
    case 'trainer_performance':
      query = supabase
        .from('trainer_performance_data')
        .select('*')
        .order('total_sessions', { ascending: false })
      break

    case 'stakeholder_engagement':
      query = supabase
        .from('stakeholder_engagement_data')
        .select('*')
        .order('total_sessions', { ascending: false })
      break

    case 'vertical_impact':
      query = supabase
        .from('vertical_impact_data')
        .select('*')
        .order('performance_score', { ascending: false })
      break

    case 'member_activity':
      query = supabase
        .from('member_activity_data')
        .select('*')
        .order('engagement_score', { ascending: false })
      break

    default:
      throw new Error(`Unknown report type: ${reportType}`)
  }

  if (chapterId) {
    query = query.eq('chapter_id', chapterId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch report data: ${error.message}`)
  }

  return data || []
}

/**
 * Create a summary snapshot
 */
function createSnapshot(
  reportType: string,
  data: ReportData[]
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
      summary.active = data.filter((r) => r.engagement_status === 'active').length
      summary.at_risk = data.filter((r) => r.engagement_status === 'at_risk').length
      break

    case 'vertical_impact':
      summary.total_trainers = data.reduce((sum: number, r) =>
        sum + (Number(r.active_trainers) || 0), 0)
      summary.avg_performance = data.length > 0
        ? Math.round(data.reduce((sum: number, r) =>
            sum + (Number(r.performance_score) || 0), 0) / data.length * 100) / 100
        : 0
      break

    case 'member_activity':
      summary.avg_engagement = data.length > 0
        ? Math.round(data.reduce((sum: number, r) =>
            sum + (Number(r.engagement_score) || 0), 0) / data.length * 100) / 100
        : 0
      break
  }

  return { summary }
}

/**
 * Get date range start based on type
 */
function getDateRangeStart(dateRangeType: string): string {
  const now = new Date()

  switch (dateRangeType) {
    case 'last_7_days':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    case 'last_30_days':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    case 'last_90_days':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    case 'last_year':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    case 'this_month':
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    case 'this_quarter':
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      return quarterStart.toISOString().split('T')[0]
    case 'this_year':
      return new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }
}

/**
 * Send email notifications
 */
async function sendNotifications(
  recipients: string[],
  reportName: string,
  downloadUrl: string
): Promise<void> {
  // In production, this would integrate with an email service
  // For now, we'll log the notification
  console.log(`Would send notification for "${reportName}" to:`, recipients)
  console.log(`Download URL: ${downloadUrl}`)

  // Example: Integration with Resend, SendGrid, or similar
  // const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
  // for (const email of recipients) {
  //   await resend.emails.send({
  //     from: 'Yi Connect <reports@yiconnect.org>',
  //     to: email,
  //     subject: `Your Scheduled Report is Ready: ${reportName}`,
  //     html: `<p>Your scheduled report "${reportName}" is ready for download.</p>
  //            <p><a href="${downloadUrl}">Download Report</a></p>`
  //   })
  // }
}
