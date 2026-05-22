/**
 * Yi Creative Connection API
 *
 * GET: Fetch connection status for a chapter
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const chapterId = searchParams.get('chapterId')

    if (!chapterId) {
      return NextResponse.json({ error: 'chapterId is required' }, { status: 400 })
    }

    // Verify user is authenticated and has access
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user's permission level and if National Admin
    const [{ data: hierarchyLevel }, { data: isNationalAdmin }] = await Promise.all([
      supabase.rpc('get_user_hierarchy_level', { p_user_id: user.id }),
      supabase.rpc('is_national_admin'),
    ])

    console.log('[Yi Creative Connection API] Permission check:', {
      userId: user.id,
      hierarchyLevel,
      isNationalAdmin,
      chapterId,
    })

    // National Admin (isNationalAdmin = true) can access everything
    // For others, need at least Chair level (4) to view integrations
    if (!isNationalAdmin && (hierarchyLevel === null || (hierarchyLevel as number) < 4)) {
      console.log('[Yi Creative Connection API] Rejected: hierarchy level too low')
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // National Admin can view any chapter, others only their own
    if (!isNationalAdmin) {
      const { data: member } = await supabase
        .from('members')
        .select('chapter_id')
        .eq('id', user.id)
        .single()

      console.log('[Yi Creative Connection API] Chapter check:', {
        memberChapterId: member?.chapter_id,
        requestedChapterId: chapterId,
        match: member?.chapter_id === chapterId,
      })

      if (member?.chapter_id !== chapterId) {
        console.log('[Yi Creative Connection API] Rejected: chapter mismatch')
        return NextResponse.json({ error: 'Cannot access this chapter' }, { status: 403 })
      }
    } else {
      console.log('[Yi Creative Connection API] National Admin - skipping chapter check')
    }

    // Fetch connection using admin client (RLS already verified above)
    const adminSupabase = createAdminSupabaseClient()
    const { data: connection, error } = await adminSupabase
      .from('yi_creative_connections')
      .select('*')
      .eq('chapter_id', chapterId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - chapter not connected
        return NextResponse.json({ connection: null }, { status: 200 })
      }
      console.error('[Yi Creative Connection API] DB error:', error.message)
      return NextResponse.json({ connection: null }, { status: 200 })
    }

    return NextResponse.json({ connection })
  } catch (error) {
    console.error('[Yi Creative Connection API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
