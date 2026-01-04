/**
 * Impersonation Audit Export API
 *
 * GET /api/admin/impersonation-audit/export
 *
 * Exports impersonation audit logs in CSV or JSON format.
 * Requires National Admin (level 6) or Super Admin (level 7) access.
 *
 * Query Parameters:
 * - format: 'csv' | 'json' (required)
 * - dateFrom: ISO date string (optional)
 * - dateTo: ISO date string (optional)
 * - adminId: UUID (optional) - filter by admin who impersonated
 * - targetUserId: UUID (optional) - filter by target user
 * - sessionId: UUID (optional) - filter by specific session
 * - includeActions: 'true' | 'false' (optional, default: false)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, getUserHierarchyLevel } from '@/lib/auth'
import type {
  AuditExportFormat,
  SessionExportEntry,
  ActionExportEntry,
  AuditExportResponse,
} from '@/types/impersonation'

// Minimum hierarchy level required (National Admin)
const MIN_REQUIRED_LEVEL = 6

/**
 * Parse and validate query parameters
 */
function parseQueryParams(searchParams: URLSearchParams): {
  format: AuditExportFormat
  dateFrom?: string
  dateTo?: string
  adminId?: string
  targetUserId?: string
  sessionId?: string
  includeActions: boolean
} {
  const format = searchParams.get('format') as AuditExportFormat
  if (!format || !['csv', 'json'].includes(format)) {
    throw new Error('Invalid or missing format parameter. Use "csv" or "json".')
  }

  return {
    format,
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
    adminId: searchParams.get('adminId') || undefined,
    targetUserId: searchParams.get('targetUserId') || undefined,
    sessionId: searchParams.get('sessionId') || undefined,
    includeActions: searchParams.get('includeActions') === 'true',
  }
}

/**
 * Convert sessions to CSV format
 */
function sessionsToCSV(sessions: SessionExportEntry[]): string {
  const headers = [
    'Session ID',
    'Admin ID',
    'Admin Name',
    'Admin Email',
    'Target User ID',
    'Target User Name',
    'Target User Email',
    'Target User Role',
    'Reason',
    'Started At',
    'Ended At',
    'End Reason',
    'Duration (minutes)',
    'Pages Visited',
    'Actions Taken',
  ]

  const rows = sessions.map((s) => [
    s.session_id,
    s.admin_id,
    escapeCSV(s.admin_name),
    s.admin_email,
    s.target_user_id,
    escapeCSV(s.target_user_name),
    s.target_user_email,
    s.target_user_role,
    escapeCSV(s.reason || ''),
    s.started_at,
    s.ended_at || '',
    s.end_reason || '',
    s.duration_minutes?.toString() || '',
    s.pages_visited.toString(),
    s.actions_taken.toString(),
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

/**
 * Convert actions to CSV format
 */
function actionsToCSV(actions: ActionExportEntry[]): string {
  const headers = [
    'Action ID',
    'Session ID',
    'Action Type',
    'Resource Type',
    'Resource ID',
    'Action Details',
    'Executed At',
    'Admin Name',
    'Target User Name',
  ]

  const rows = actions.map((a) => [
    a.action_id,
    a.session_id,
    a.action_type,
    a.resource_type,
    a.resource_id || '',
    escapeCSV(a.action_details || ''),
    a.executed_at,
    escapeCSV(a.admin_name),
    escapeCSV(a.target_user_name),
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

/**
 * Escape a value for CSV
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * GET handler for audit export
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Please log in' },
        { status: 401 }
      )
    }

    // Check admin permission
    const hierarchyLevel = await getUserHierarchyLevel()
    if (hierarchyLevel < MIN_REQUIRED_LEVEL) {
      return NextResponse.json(
        { error: 'Forbidden: National Admin or Super Admin access required' },
        { status: 403 }
      )
    }

    // Parse query parameters
    let params
    try {
      params = parseQueryParams(request.nextUrl.searchParams)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid parameters' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Build sessions query
    let sessionsQuery = supabase
      .from('impersonation_sessions')
      .select(`
        id,
        admin_id,
        target_user_id,
        reason,
        started_at,
        ended_at,
        end_reason,
        timeout_minutes,
        pages_visited,
        actions_taken,
        admin:profiles!impersonation_sessions_admin_id_fkey(full_name, email),
        target:profiles!impersonation_sessions_target_user_id_fkey(full_name, email)
      `)
      .order('started_at', { ascending: false })

    // Apply filters
    if (params.dateFrom) {
      sessionsQuery = sessionsQuery.gte('started_at', params.dateFrom)
    }
    if (params.dateTo) {
      sessionsQuery = sessionsQuery.lte('started_at', params.dateTo)
    }
    if (params.adminId) {
      sessionsQuery = sessionsQuery.eq('admin_id', params.adminId)
    }
    if (params.targetUserId) {
      sessionsQuery = sessionsQuery.eq('target_user_id', params.targetUserId)
    }
    if (params.sessionId) {
      sessionsQuery = sessionsQuery.eq('id', params.sessionId)
    }

    const { data: sessionsData, error: sessionsError } = await sessionsQuery

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError)
      return NextResponse.json(
        { error: 'Failed to fetch impersonation sessions' },
        { status: 500 }
      )
    }

    // Get target user roles
    const targetUserIds = [...new Set(sessionsData?.map((s) => s.target_user_id) || [])]

    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('user_id, role:roles(name)')
      .in('user_id', targetUserIds.length > 0 ? targetUserIds : ['00000000-0000-0000-0000-000000000000'])

    // Create a map of user_id -> role_name
    const roleMap = new Map<string, string>()
    rolesData?.forEach((ur) => {
      // Supabase returns the join as an object or array depending on the relationship
      // Cast to unknown first to handle Supabase's dynamic typing
      const roleData = ur.role as unknown as { name: string } | { name: string }[] | null
      let roleName = 'Member'
      if (Array.isArray(roleData)) {
        roleName = roleData[0]?.name || 'Member'
      } else if (roleData) {
        roleName = roleData.name || 'Member'
      }
      // Keep highest hierarchy role (later entries in sorted data may override)
      if (!roleMap.has(ur.user_id)) {
        roleMap.set(ur.user_id, roleName)
      }
    })

    // Helper to extract profile data from Supabase join (handles array/object)
    type ProfileData = { full_name: string; email: string }
    function extractProfile(data: unknown): ProfileData | null {
      if (!data) return null
      if (Array.isArray(data)) {
        return data[0] as ProfileData | null
      }
      return data as ProfileData
    }

    // Transform sessions to export format
    const sessions: SessionExportEntry[] = (sessionsData || []).map((s) => {
      const admin = extractProfile(s.admin)
      const target = extractProfile(s.target)

      // Calculate duration
      let durationMinutes: number | null = null
      if (s.ended_at) {
        const start = new Date(s.started_at).getTime()
        const end = new Date(s.ended_at).getTime()
        durationMinutes = Math.round((end - start) / 60000)
      }

      return {
        session_id: s.id,
        admin_id: s.admin_id,
        admin_name: admin?.full_name || 'Unknown',
        admin_email: admin?.email || '',
        target_user_id: s.target_user_id,
        target_user_name: target?.full_name || 'Unknown',
        target_user_email: target?.email || '',
        target_user_role: roleMap.get(s.target_user_id) || 'Member',
        reason: s.reason,
        started_at: s.started_at,
        ended_at: s.ended_at,
        end_reason: s.end_reason,
        duration_minutes: durationMinutes,
        pages_visited: s.pages_visited,
        actions_taken: s.actions_taken,
      }
    })

    // Fetch actions if requested
    let actions: ActionExportEntry[] | undefined
    if (params.includeActions) {
      const sessionIds = sessions.map((s) => s.session_id)

      if (sessionIds.length > 0) {
        const { data: actionsData, error: actionsError } = await supabase
          .from('impersonation_action_log')
          .select(`
            id,
            session_id,
            action_type,
            table_name,
            record_id,
            payload_summary,
            executed_at
          `)
          .in('session_id', sessionIds)
          .order('executed_at', { ascending: true })

        if (actionsError) {
          console.error('Error fetching actions:', actionsError)
        } else {
          // Create session lookup for admin/target names
          const sessionLookup = new Map(
            sessions.map((s) => [s.session_id, s])
          )

          actions = (actionsData || []).map((a) => {
            const session = sessionLookup.get(a.session_id)
            return {
              action_id: a.id,
              session_id: a.session_id,
              action_type: a.action_type,
              resource_type: a.table_name,
              resource_id: a.record_id,
              action_details: a.payload_summary
                ? JSON.stringify(a.payload_summary)
                : null,
              executed_at: a.executed_at,
              admin_name: session?.admin_name || 'Unknown',
              target_user_name: session?.target_user_name || 'Unknown',
            }
          })
        }
      }
    }

    // Format response based on requested format
    if (params.format === 'json') {
      const response: AuditExportResponse = {
        sessions,
        actions,
        exportedAt: new Date().toISOString(),
        filters: {
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          adminId: params.adminId,
          targetUserId: params.targetUserId,
          sessionId: params.sessionId,
          includeActions: params.includeActions,
        },
      }

      return NextResponse.json(response, {
        headers: {
          'Content-Disposition': `attachment; filename="impersonation-audit-${new Date().toISOString().split('T')[0]}.json"`,
        },
      })
    }

    // CSV format
    let csvContent = '# Impersonation Audit Export\n'
    csvContent += `# Exported: ${new Date().toISOString()}\n`
    csvContent += `# Filters: ${JSON.stringify({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      adminId: params.adminId,
      targetUserId: params.targetUserId,
    })}\n\n`

    csvContent += '## SESSIONS\n'
    csvContent += sessionsToCSV(sessions)

    if (actions && actions.length > 0) {
      csvContent += '\n\n## ACTIONS\n'
      csvContent += actionsToCSV(actions)
    }

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="impersonation-audit-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
